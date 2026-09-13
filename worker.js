import { qrcode } from "qrcode-generator";

const ADMIN_EMAIL = "tajtaranga@gmail.com";
const SESSION_COOKIE = "melo_admin_session";
const SESSION_TTL = 8 * 60 * 60;
const SETUP_TTL = 10 * 60;
const RATE_WINDOW = 10 * 60;
const MAX_ATTEMPTS = 5;
const TELEMETRY_RATE_WINDOW = 60;
const TELEMETRY_MAX_EVENTS = 30;
const TELEMETRY_MAX_BODY = 64 * 1024;
const ALLOWED_EVENT_TYPES = new Set(["install", "heartbeat", "version", "crash"]);
const ALLOWED_PLATFORMS = new Set(["windows"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/admin/")) return await handleApi(request, env, url);
      if (url.pathname.startsWith("/api/telemetry/")) return await handleTelemetry(request, env, url);
      if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
        const session = await getSession(request, env);
        if (!session) return Response.redirect(`${url.origin}/admin-login.html`, 302);
      }
      return withSecurityHeaders(await env.ASSETS.fetch(request));
    } catch (error) {
      console.error("MELO Worker error", error);
      return json({ error: "Internal server error." }, 500);
    }
  }
};

async function handleApi(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, url) });
  if (url.pathname === "/api/admin/status" && request.method === "GET") {
    const row = await env.DB.prepare("SELECT setup_complete, totp_secret_enc FROM admin_config WHERE id = 1").first();
    const configured = Boolean(row?.totp_secret_enc);
    if (configured && !row?.setup_complete) await env.DB.prepare("UPDATE admin_config SET setup_complete = 1, updated_at = ? WHERE id = 1").bind(Math.floor(Date.now() / 1000)).run();
    return json({ configured });
  }
  if (url.pathname === "/api/admin/setup/start" && request.method === "POST") return setupStart(request, env, url);
  if (url.pathname === "/api/admin/setup/verify" && request.method === "POST") return setupVerify(request, env, url);
  if (url.pathname === "/api/admin/login" && request.method === "POST") return login(request, env, url);
  if (url.pathname === "/api/admin/logout" && request.method === "POST") return logout(request, env, url);
  if (url.pathname === "/api/admin/me" && request.method === "GET") return me(request, env, url);
  if (url.pathname === "/api/admin/health" && request.method === "GET") return json({ ok: true, service: "melo-admin" });
  return json({ error: "Not found." }, 404);
}

async function handleTelemetry(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, url) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOriginForTelemetry(request, url)) return json({ error: "Invalid origin." }, 403);
  const contentLength = Number(request.headers.get("Content-Length") || 0);
  if (contentLength > TELEMETRY_MAX_BODY) return json({ error: "Payload too large." }, 413);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim();
  const body = await readJsonLimited(request, TELEMETRY_MAX_BODY);
  const auth = await authenticateTelemetry(token, env);
  if (!auth) return json({ error: "Invalid telemetry credential." }, 401);
  if (await telemetryRateLimited(env, auth.installation_id)) return json({ error: "Too many telemetry events. Try again later." }, 429);
  const validation = validateTelemetry(body);
  if (!validation.ok) return json({ error: validation.error }, 400);
  if (body.installation_id !== auth.installation_id) return json({ error: "Installation credential mismatch." }, 403);
  return recordTelemetry(body, env, auth);
}

async function authenticateTelemetry(token, env) {
  if (!token || token.length < 32 || token.length > 256) return null;
  const tokenHash = await sha256Hex(token);
  const row = await env.DB.prepare("SELECT installation_id, token_hash, revoked_at FROM telemetry_credentials WHERE token_hash = ?").bind(tokenHash).first();
  if (!row || row.revoked_at) return null;
  return row;
}

function validateTelemetry(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid JSON payload." };
  const id = String(body.installation_id || "");
  const eventId = String(body.event_id || "");
  const type = String(body.event_type || "");
  const timestamp = Number(body.timestamp);
  const version = String(body.app_version || "");
  const build = body.build == null ? "" : String(body.build);
  const platform = String(body.platform || "");
  const os = body.os_version == null ? "" : String(body.os_version);
  const schema = Number(body.client_schema);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(id)) return { ok: false, error: "Invalid installation_id." };
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(eventId)) return { ok: false, error: "Invalid event_id." };
  if (!ALLOWED_EVENT_TYPES.has(type)) return { ok: false, error: "Invalid event_type." };
  if (!Number.isInteger(timestamp) || timestamp < 1 || timestamp > Math.floor(Date.now() / 1000) + 300) return { ok: false, error: "Invalid timestamp." };
  if (!/^\d{1,32}(?:\.\d{1,32}){0,3}$/.test(version) || version.length > 64) return { ok: false, error: "Invalid app_version." };
  if (build.length > 64 || platform.length > 32 || os.length > 128) return { ok: false, error: "Telemetry field too long." };
  if (!ALLOWED_PLATFORMS.has(platform)) return { ok: false, error: "Unsupported platform." };
  if (!Number.isInteger(schema) || schema !== 1) return { ok: false, error: "Unsupported client_schema." };
  if (type === "crash") {
    const crash = body.crash;
    if (!crash || typeof crash !== "object" || Array.isArray(crash)) return { ok: false, error: "Invalid crash payload." };
    if (String(crash.error_type || "").length > 128 || String(crash.message || "").length > 4096 || String(crash.stack_trace || "").length > 16384) return { ok: false, error: "Crash payload too large." };
    if (!["error", "fatal", "warning"].includes(String(crash.severity || "error"))) return { ok: false, error: "Invalid crash severity." };
  }
  return { ok: true };
}

async function recordTelemetry(body, env, auth) {
  const now = Math.floor(Date.now() / 1000);
  try {
    await env.DB.prepare(`INSERT INTO telemetry_events (event_id, installation_id, event_type, timestamp, app_version, build, platform, os_version, client_schema, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.event_id, body.installation_id, body.event_type, body.timestamp, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, now).run();
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) return json({ ok: true, duplicate: true });
    throw error;
  }

  if (body.event_type === "install") {
    const credential = randomToken(32);
    const hash = await sha256Hex(credential);
    await env.DB.prepare(`INSERT INTO installations (installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(installation_id) DO UPDATE SET app_version=excluded.app_version, build=excluded.build, platform=excluded.platform, os_version=excluded.os_version, client_schema=excluded.client_schema, last_seen=excluded.last_seen, updated_at=excluded.updated_at`).bind(body.installation_id, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, body.timestamp, body.timestamp, now, now).run();
    await env.DB.prepare(`INSERT OR IGNORE INTO telemetry_credentials (installation_id, token_hash, created_at) VALUES (?, ?, ?)`).bind(body.installation_id, hash, now).run();
    await env.DB.prepare("UPDATE telemetry_credentials SET last_used_at = ? WHERE installation_id = ? AND revoked_at IS NULL").bind(now, body.installation_id).run();
    return json({ ok: true, registered: true, telemetry_token: credential });
  }

  await env.DB.prepare(`INSERT INTO installations (installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(installation_id) DO UPDATE SET app_version=excluded.app_version, build=excluded.build, platform=excluded.platform, os_version=excluded.os_version, client_schema=excluded.client_schema, last_seen=excluded.last_seen, updated_at=excluded.updated_at`).bind(body.installation_id, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, body.timestamp, body.timestamp, now, now).run();
  await env.DB.prepare("UPDATE telemetry_credentials SET last_used_at = ? WHERE installation_id = ? AND revoked_at IS NULL").bind(now, body.installation_id).run();

  if (body.event_type === "crash") {
    const crash = body.crash;
    await env.DB.prepare(`INSERT INTO crash_reports (crash_id, event_id, installation_id, error_type, message, stack_trace, severity, app_version, build, platform, os_version, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(randomToken(18), body.event_id, body.installation_id, sanitizeText(crash.error_type, 128), sanitizeText(crash.message, 4096), sanitizeStack(crash.stack_trace, 16384), crash.severity || "error", body.app_version, body.build || null, body.platform, body.os_version || null, body.timestamp, now).run();
  }
  return json({ ok: true, recorded: true });
}

async function telemetryRateLimited(env, installationId) {
  const key = `telemetry:${installationId}`;
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare("SELECT window_start, count FROM admin_attempts WHERE key = ?").bind(key).first();
  if (!row || now - row.window_start >= TELEMETRY_RATE_WINDOW) {
    await env.DB.prepare("INSERT INTO admin_attempts (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start, count=1").bind(key, now).run();
    return false;
  }
  if (row.count >= TELEMETRY_MAX_EVENTS) return true;
  await env.DB.prepare("UPDATE admin_attempts SET count=count+1 WHERE key=?").bind(key).run();
  return false;
}

function sanitizeText(value, max) {
  return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max);
}

function sanitizeStack(value, max) {
  return sanitizeText(value, max).replace(/(?:Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]").replace(/(?:token|secret|password|api[_-]?key)\s*[:=]\s*[^\s]+/gi, "$1=[REDACTED]");
}

async function setupStart(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  const body = await readJson(request); const email = normalizeEmail(body.email); const token = request.headers.get("X-MELO-Setup-Token") || "";
  if (email !== ADMIN_EMAIL || !token || !timingSafeEqual(token, env.ADMIN_SETUP_TOKEN || "")) return json({ error: "Unauthorized setup request." }, 403);
  const existing = await env.DB.prepare("SELECT setup_complete, totp_secret_enc FROM admin_config WHERE id = 1").first();
  if (existing?.setup_complete || existing?.totp_secret_enc) return json({ error: "Admin setup is already complete." }, 409);
  if (await rateLimited(env, `setup:${email}`)) return json({ error: "Too many setup attempts. Try again later." }, 429);
  const secret = generateBase32Secret(); const now = Math.floor(Date.now() / 1000); const encrypted = await encryptSecret(secret, env.ADMIN_ENCRYPTION_KEY); const pendingUntil = now + SETUP_TTL;
  await env.DB.prepare(`INSERT INTO admin_config (id, email, pending_secret_enc, pending_expires_at, setup_complete, created_at, updated_at) VALUES (1, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, pending_secret_enc=excluded.pending_secret_enc, pending_expires_at=excluded.pending_expires_at, updated_at=excluded.updated_at`).bind(ADMIN_EMAIL, encrypted, pendingUntil, now, now).run();
  const otpauth = `otpauth://totp/${encodeURIComponent("MELO")}:${encodeURIComponent(ADMIN_EMAIL)}?secret=${secret}&issuer=${encodeURIComponent("MELO")}&algorithm=SHA1&digits=6&period=30`; const qr = qrcode(0, "M"); qr.addData(otpauth); qr.make(); const svg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true }); const qrCodeDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return json({ setupKey: secret, qrCodeDataUrl, expiresIn: SETUP_TTL });
}
async function setupVerify(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); return completeSetupOrLogin(request, env, url, await readJson(request), true); }
async function login(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); return completeSetupOrLogin(request, env, url, await readJson(request), false); }
async function completeSetupOrLogin(request, env, url, body, isSetup) {
  const email = normalizeEmail(body.email); const code = String(body.code || "");
  if (email !== ADMIN_EMAIL || !/^\d{6}$/.test(code)) return json({ error: "Invalid administrator credentials." }, 401);
  if (await rateLimited(env, `login:${email}`)) return json({ error: "Too many attempts. Try again later." }, 429);
  const row = await env.DB.prepare("SELECT * FROM admin_config WHERE id = 1").first(); if (!row || row.email !== ADMIN_EMAIL) return json({ error: "Admin setup has not been initialized." }, 409);
  let secret;
  if (isSetup) { if (row.setup_complete || row.totp_secret_enc) return json({ error: "Setup is already complete. Use normal login." }, 409); if (!row.pending_secret_enc || !row.pending_expires_at || row.pending_expires_at < Math.floor(Date.now() / 1000)) return json({ error: "Setup expired. Start authenticator setup again." }, 410); secret = await decryptSecret(row.pending_secret_enc, env.ADMIN_ENCRYPTION_KEY); }
  else { if (!row.totp_secret_enc) return json({ error: "Complete Authenticator setup first." }, 409); secret = await decryptSecret(row.totp_secret_enc, env.ADMIN_ENCRYPTION_KEY); }
  if (!(await verifyTotp(secret, code))) return json({ error: "Invalid or expired Authenticator code." }, 401);
  const now = Math.floor(Date.now() / 1000);
  if (isSetup) await env.DB.prepare(`UPDATE admin_config SET totp_secret_enc=pending_secret_enc, pending_secret_enc=NULL, pending_expires_at=NULL, setup_complete=1, updated_at=? WHERE id=1`).bind(now).run(); else if (!row.setup_complete) await env.DB.prepare("UPDATE admin_config SET setup_complete=1, updated_at=? WHERE id=1").bind(now).run();
  await env.DB.prepare("DELETE FROM admin_attempts WHERE key=?").bind(`login:${email}`).run(); return createSessionResponse(env, url.origin);
}
async function createSessionResponse(env, origin) { const raw=randomToken(32); const hash=await sha256Hex(raw); const now=Math.floor(Date.now()/1000); const expires=now+SESSION_TTL; await env.DB.prepare("INSERT INTO admin_sessions (token_hash,created_at,expires_at) VALUES (?,?,?)").bind(hash,now,expires).run(); const headers=new Headers({"Content-Type":"application/json","Cache-Control":"no-store"}); headers.append("Set-Cookie",`${SESSION_COOKIE}=${raw}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Strict`); return new Response(JSON.stringify({ok:true,redirect:"/admin/"}),{status:200,headers}); }
async function getSession(request, env) { const cookie=request.headers.get("Cookie")||""; const match=cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)); if(!match)return null; const hash=await sha256Hex(match[1]); const row=await env.DB.prepare("SELECT token_hash,expires_at FROM admin_sessions WHERE token_hash=?").bind(hash).first(); if(!row)return null; if(row.expires_at<=Math.floor(Date.now()/1000)){await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(hash).run();return null;} return row; }
async function me(request, env) { const session=await getSession(request,env); if(!session)return json({authenticated:false},401); return json({authenticated:true,email:ADMIN_EMAIL,expiresAt:session.expires_at}); }
async function logout(request, env, url) { if(!sameOrigin(request,url))return json({error:"Invalid origin."},403); const cookie=request.headers.get("Cookie")||""; const match=cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)); if(match){const hash=await sha256Hex(match[1]);await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(hash).run();} const headers=new Headers({"Content-Type":"application/json","Cache-Control":"no-store"}); headers.set("Set-Cookie",`${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`); return new Response(JSON.stringify({ok:true}),{status:200,headers}); }
async function rateLimited(env,key){const now=Math.floor(Date.now()/1000);const row=await env.DB.prepare("SELECT window_start,count FROM admin_attempts WHERE key=?").bind(key).first();if(!row||now-row.window_start>=RATE_WINDOW){await env.DB.prepare("INSERT INTO admin_attempts (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1").bind(key,now).run();return false;}if(row.count>=MAX_ATTEMPTS)return true;await env.DB.prepare("UPDATE admin_attempts SET count=count+1 WHERE key=?").bind(key).run();return false;}
async function verifyTotp(secret,code){const now=Math.floor(Date.now()/1000);for(const offset of[-1,0,1])if(await totpForCounter(secret,Math.floor(now/30)+offset)===code)return true;return false;}
async function totpForCounter(secret,counter){const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);const buffer=new ArrayBuffer(8);const view=new DataView(buffer);view.setUint32(0,Math.floor(counter/0x100000000));view.setUint32(4,counter>>>0);const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,buffer));const offset=digest[digest.length-1]&0x0f;const binary=((digest[offset]&0x7f)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];return String(binary%1000000).padStart(6,"0");}
function base32Decode(value){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";const clean=value.toUpperCase().replace(/=+$/g,"");let bits=0,buffer=0;const output=[];for(const char of clean){const index=alphabet.indexOf(char);if(index<0)throw new Error("Invalid Base32 secret");buffer=(buffer<<5)|index;bits+=5;if(bits>=8){bits-=8;output.push((buffer>>bits)&0xff);}}return new Uint8Array(output);}
function generateBase32Secret(bytes=20){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";const random=new Uint8Array(bytes);crypto.getRandomValues(random);let buffer=0,bits=0,output="";for(const byte of random){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;output+=alphabet[(buffer>>bits)&31];}}if(bits)output+=alphabet[(buffer<<(5-bits))&31];return output;}
async function encryptSecret(secret,encryptionKey){const key=await deriveKey(encryptionKey);const iv=crypto.getRandomValues(new Uint8Array(12));const data=new TextEncoder().encode(secret);const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data));return `${toBase64(iv)}.${toBase64(encrypted)}`;}
async function decryptSecret(value,encryptionKey){const[ivText,dataText]=String(value).split(".");const key=await deriveKey(encryptionKey);const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64(ivText)},key,fromBase64(dataText));return new TextDecoder().decode(plaintext);}
async function deriveKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret||""));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function sha256Hex(value){const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return[...digest].map(b=>b.toString(16).padStart(2,"0")).join("");}
function randomToken(bytes){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return toBase64Url(data);}
function toBase64(data){let binary="";for(const byte of data)binary+=String.fromCharCode(byte);return btoa(binary);}
function fromBase64(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
function toBase64Url(data){return toBase64(data).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function normalizeEmail(value){return String(value||"").trim().toLowerCase();}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
function sameOrigin(request,url){const origin=request.headers.get("Origin");return !origin||origin===url.origin;}
function sameOriginForTelemetry(request,url){const origin=request.headers.get("Origin");return !origin||origin===url.origin;}
async function readJson(request){try{return await request.json();}catch{throw new Error("Invalid JSON request.");}}
async function readJsonLimited(request,maxBytes){const reader=request.body?.getReader();if(!reader)return readJson(request);let total=0;const chunks=[];while(true){const{done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes)throw new Error("Payload too large.");chunks.push(value);}const merged=new Uint8Array(total);let offset=0;for(const chunk of chunks){merged.set(chunk,offset);offset+=chunk.byteLength;}try{return JSON.parse(new TextDecoder().decode(merged));}catch{throw new Error("Invalid JSON request.");}}
function corsHeaders(request,url){const origin=request.headers.get("Origin");const headers={"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-MELO-Setup-Token"};if(origin===url.origin)headers["Access-Control-Allow-Origin"]=origin;return headers;}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
function withSecurityHeaders(response){const headers=new Headers(response.headers);headers.set("X-Content-Type-Options","nosniff");headers.set("Referrer-Policy","strict-origin-when-cross-origin");headers.set("X-Frame-Options","DENY");return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}

import { qrcode } from "qrcode-generator";
import originalWorker from "./worker.js";

const ADMIN_EMAIL_FALLBACK = "tajtaranga@gmail.com";
const DEFAULT_OWNER_USERNAME = "Yuki";
const SESSION_COOKIE = "melo_admin_session";
const SESSION_TTL = 8 * 60 * 60;
const SETUP_TTL = 10 * 60;
const INVITE_TTL = 24 * 60 * 60;
const RATE_WINDOW = 10 * 60;
const MAX_ATTEMPTS = 5;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/admin/status" && request.method === "GET") return adminStatus(env);
      if (url.pathname === "/api/admin/setup/start" && request.method === "POST") return setupStart(request, env, url);
      if (url.pathname === "/api/admin/setup/verify" && request.method === "POST") return setupVerify(request, env, url);
      if (url.pathname === "/api/admin/login" && request.method === "POST") return login(request, env, url);
      if (url.pathname === "/api/admin/me" && request.method === "GET") return me(request, env);
      if (url.pathname === "/api/admin/logout" && request.method === "POST") return logout(request, env, url);
      if (url.pathname === "/api/admin/administrators" && request.method === "GET") return listAdministrators(request, env);
      if (url.pathname === "/api/admin/administrators" && request.method === "POST") return createAdministrator(request, env, url);
      if (url.pathname.startsWith("/api/admin/administrators/") && request.method === "POST") return administratorAction(request, env, url);
      if (url.pathname === "/api/admin/invite/info" && request.method === "GET") return inviteInfo(request, env, url);
      if (url.pathname === "/api/admin/invite/setup/start" && request.method === "POST") return inviteSetupStart(request, env, url);
      if (url.pathname === "/api/admin/invite/setup/verify" && request.method === "POST") return inviteSetupVerify(request, env, url);
      return originalWorker.fetch(request, env);
    } catch (error) {
      console.error("MELO auth worker error", error);
      return json({ error: "Internal server error." }, 500);
    }
  }
};

async function ensureAuthSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_accounts (
      admin_id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL DEFAULT 'admin',
      totp_secret_enc TEXT,
      pending_secret_enc TEXT,
      pending_expires_at INTEGER,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      last_login_at INTEGER
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_accounts_enabled ON admin_accounts(enabled)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_identity_sessions (
      token_hash TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admin_accounts(admin_id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_identity_sessions_admin ON admin_identity_sessions(admin_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_sessions (
      token_hash TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_attempts (
      key TEXT PRIMARY KEY,
      window_start INTEGER NOT NULL,
      count INTEGER NOT NULL DEFAULT 0
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_invitations (
      invitation_id TEXT PRIMARY KEY,
      admin_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL,
      used_at INTEGER,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (admin_id) REFERENCES admin_accounts(admin_id) ON DELETE CASCADE
    )`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_invitations_admin ON admin_invitations(admin_id)`)
  ]);

  const legacy = await env.DB.prepare("SELECT email, totp_secret_enc, pending_secret_enc, pending_expires_at, setup_complete, created_at, updated_at FROM admin_config WHERE id=1").first();
  const existing = await env.DB.prepare("SELECT admin_id, username, email, role, totp_secret_enc, pending_secret_enc, pending_expires_at FROM admin_accounts ORDER BY created_at LIMIT 1").first();
  const now = Math.floor(Date.now() / 1000);

  if (!existing && (legacy?.email || legacy?.totp_secret_enc || legacy?.pending_secret_enc)) {
    await env.DB.prepare(`INSERT OR IGNORE INTO admin_accounts (admin_id,username,email,role,totp_secret_enc,pending_secret_enc,pending_expires_at,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .bind("admin_owner", DEFAULT_OWNER_USERNAME, normalizeEmail(legacy.email || ADMIN_EMAIL_FALLBACK), "owner", legacy.totp_secret_enc || null, legacy.pending_secret_enc || null, legacy.pending_expires_at || null, 1, legacy.created_at || now, legacy.updated_at || now).run();
  } else if (existing && existing.username === "yuki") {
    await env.DB.prepare("UPDATE admin_accounts SET username=?, updated_at=? WHERE admin_id=?").bind(DEFAULT_OWNER_USERNAME, now, existing.admin_id).run();
  } else if (existing && !existing.totp_secret_enc && legacy?.totp_secret_enc) {
    await env.DB.prepare(`UPDATE admin_accounts SET totp_secret_enc=?, pending_secret_enc=NULL, pending_expires_at=NULL, updated_at=? WHERE admin_id=?`).bind(legacy.totp_secret_enc, now, existing.admin_id).run();
  }
}

async function adminStatus(env) {
  await ensureAuthSchema(env);
  const row = await env.DB.prepare("SELECT admin_id, username, email, role, enabled, totp_secret_enc FROM admin_accounts ORDER BY created_at LIMIT 1").first();
  return json({ configured: Boolean(row?.totp_secret_enc && row?.enabled), username: row?.username || null });
}

async function setupStart(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  await ensureAuthSchema(env);
  const body = await readJson(request);
  const username = normalizeUsername(body?.username);
  const email = normalizeEmail(body?.email);
  const token = String(request.headers.get("X-MELO-Setup-Token") || "");
  if (!username || !email || !isEmail(email) || !token || !timingSafeEqual(token, String(env.ADMIN_SETUP_TOKEN || ""))) return json({ error: "Unauthorized setup request." }, 403);
  const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM admin_accounts").first();
  if (Number(count?.count || 0) > 0) return json({ error: "An administrator account already exists." }, 409);
  if (await rateLimited(env, `setup:${email}`)) return json({ error: "Too many setup attempts. Try again later." }, 429);
  const secret = generateBase32Secret();
  const now = Math.floor(Date.now() / 1000);
  const encrypted = await encryptSecret(secret, env.ADMIN_ENCRYPTION_KEY);
  const pendingUntil = now + SETUP_TTL;
  await env.DB.prepare(`INSERT INTO admin_accounts (admin_id,username,email,role,pending_secret_enc,pending_expires_at,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind("admin_owner", username, email, "owner", encrypted, pendingUntil, 1, now, now).run();
  const otpauth = `otpauth://totp/${encodeURIComponent("MELO")}:${encodeURIComponent(username)}?secret=${secret}&issuer=${encodeURIComponent("MELO")}&algorithm=SHA1&digits=6&period=30`;
  const qr = qrcode(0, "M"); qr.addData(otpauth); qr.make();
  const svg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true });
  return json({ setupKey: secret, qrCodeDataUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, expiresIn: SETUP_TTL });
}

async function setupVerify(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  return completeLogin(request, env, url, await readJson(request), true);
}

async function login(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  return completeLogin(request, env, url, await readJson(request), false);
}

async function completeLogin(request, env, url, body, isSetup) {
  await ensureAuthSchema(env);
  const username = normalizeUsername(body?.username);
  const email = normalizeEmail(body?.email);
  const code = String(body?.code || "");
  if (!username || !/^\d{6}$/.test(code)) return json({ error: "Invalid administrator credentials." }, 401);
  if (await rateLimited(env, `login:${username}`)) return json({ error: "Too many attempts. Try again later." }, 429);
  const row = await env.DB.prepare("SELECT * FROM admin_accounts WHERE username=? AND enabled=1").bind(username).first();
  if (!row) return json({ error: "Invalid administrator credentials." }, 401);
  if (isSetup) {
    if (row.totp_secret_enc || !email || email !== normalizeEmail(row.email)) return json({ error: "Invalid administrator setup." }, 401);
    if (!row.pending_secret_enc || !row.pending_expires_at || row.pending_expires_at < Math.floor(Date.now() / 1000)) return json({ error: "Setup expired. Start authenticator setup again." }, 410);
  } else if (!row.totp_secret_enc) return json({ error: "Complete Authenticator setup first." }, 409);
  const encrypted = isSetup ? row.pending_secret_enc : row.totp_secret_enc;
  let secret;
  try { secret = await decryptSecret(encrypted, env.ADMIN_ENCRYPTION_KEY); } catch (error) { console.error("MELO admin TOTP decrypt failed", error); return json({ error: "Admin authentication is temporarily unavailable." }, 503); }
  if (!(await verifyTotp(secret, code))) return json({ error: "Invalid or expired Authenticator code." }, 401);
  const now = Math.floor(Date.now() / 1000);
  if (isSetup) {
    await env.DB.prepare("UPDATE admin_accounts SET totp_secret_enc=pending_secret_enc,pending_secret_enc=NULL,pending_expires_at=NULL,updated_at=?,last_login_at=? WHERE admin_id=?").bind(now, now, row.admin_id).run();
    await env.DB.prepare("INSERT INTO admin_config (id,email,setup_complete,created_at,updated_at) VALUES (1,?,1,?,?) ON CONFLICT(id) DO UPDATE SET email=excluded.email,setup_complete=1,updated_at=excluded.updated_at").bind(row.email, now, now).run();
  } else await env.DB.prepare("UPDATE admin_accounts SET last_login_at=?,updated_at=? WHERE admin_id=?").bind(now, now, row.admin_id).run();
  await env.DB.prepare("DELETE FROM admin_attempts WHERE key=?").bind(`login:${username}`).run();
  return createSessionResponse(env, row.admin_id);
}

async function createSessionResponse(env, adminId) {
  const raw = randomToken(32), hash = await sha256Hex(raw), now = Math.floor(Date.now() / 1000), expires = now + SESSION_TTL;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admin_sessions (token_hash,created_at,expires_at) VALUES (?,?,?) ON CONFLICT(token_hash) DO UPDATE SET expires_at=excluded.expires_at").bind(hash, now, expires),
    env.DB.prepare("INSERT INTO admin_identity_sessions (token_hash,admin_id,created_at,expires_at) VALUES (?,?,?,?)").bind(hash, adminId, now, expires)
  ]);
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" });
  headers.append("Set-Cookie", `${SESSION_COOKIE}=${raw}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Strict`);
  return new Response(JSON.stringify({ ok: true, redirect: "/admin/" }), { status: 200, headers });
}

async function getIdentitySession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const hash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(`SELECT s.token_hash,s.expires_at,a.admin_id,a.username,a.email,a.role,a.enabled FROM admin_identity_sessions s JOIN admin_accounts a ON a.admin_id=s.admin_id WHERE s.token_hash=? AND a.enabled=1`).bind(hash).first();
  if (!row) return null;
  if (Number(row.expires_at) <= Math.floor(Date.now() / 1000)) { await env.DB.prepare("DELETE FROM admin_identity_sessions WHERE token_hash=?").bind(hash).run(); return null; }
  return row;
}

async function me(request, env) {
  await ensureAuthSchema(env); const session = await getIdentitySession(request, env);
  if (!session) return json({ authenticated: false }, 401);
  return json({ authenticated: true, adminId: session.admin_id, username: session.username, email: session.email, role: session.role, expiresAt: session.expires_at });
}

async function logout(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  const cookie = request.headers.get("Cookie") || "", match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" }); headers.set("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`);
  if (match) { const hash = await sha256Hex(match[1]); await env.DB.batch([env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(hash), env.DB.prepare("DELETE FROM admin_identity_sessions WHERE token_hash=?").bind(hash)]); }
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
}

async function requireOwner(request, env) {
  await ensureAuthSchema(env); const session = await getIdentitySession(request, env);
  if (!session) return { error: json({ error: "Authentication required." }, 401) };
  if (session.role !== "owner" || session.username !== DEFAULT_OWNER_USERNAME) return { error: json({ error: "Owner access required." }, 403) };
  return { session };
}

async function listAdministrators(request, env) {
  const auth = await requireOwner(request, env); if (auth.error) return auth.error;
  const rows = await env.DB.prepare("SELECT admin_id,username,email,role,enabled,totp_secret_enc,created_at,updated_at,last_login_at FROM admin_accounts ORDER BY created_at ASC").all();
  const invites = await env.DB.prepare("SELECT admin_id,expires_at,used_at FROM admin_invitations WHERE used_at IS NULL AND expires_at>? ORDER BY created_at DESC").bind(Math.floor(Date.now()/1000)).all();
  const inviteMap = new Map((invites.results || []).map(x => [x.admin_id, x]));
  return json({ rows: (rows.results || []).map(r => ({ admin_id:r.admin_id, username:r.username, email:r.email, role:r.role, enabled:Boolean(r.enabled), configured:Boolean(r.totp_secret_enc), created_at:r.created_at, updated_at:r.updated_at, last_login_at:r.last_login_at, pending_invitation:Boolean(inviteMap.get(r.admin_id)) })) });
}

async function createAdministrator(request, env, url) {
  if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403);
  const auth = await requireOwner(request, env); if (auth.error) return auth.error;
  if (await rateLimited(env, `admin-create:${auth.session.admin_id}`)) return json({ error: "Too many administrator changes. Try again later." }, 429);
  const body = await readJson(request), username = normalizeUsername(body?.username), email = normalizeEmail(body?.email);
  if (!username) return json({ error: "Use 3–32 letters, numbers, underscores or hyphens." }, 400);
  if (!email || !isEmail(email)) return json({ error: "Enter a valid administrator email address." }, 400);
  if (username === DEFAULT_OWNER_USERNAME) return json({ error: "That username is reserved for the Owner." }, 409);
  const existing = await env.DB.prepare("SELECT admin_id FROM admin_accounts WHERE username=? OR email=?").bind(username, email).first();
  if (existing) return json({ error: "That username or email is already in use." }, 409);
  const adminId = `admin_${randomToken(12)}`;
  const rawInvite = randomToken(32), tokenHash = await sha256Hex(rawInvite), now = Math.floor(Date.now()/1000), expires = now + INVITE_TTL;
  await env.DB.batch([
    env.DB.prepare("INSERT INTO admin_accounts (admin_id,username,email,role,enabled,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind(adminId, username, email, "admin", 1, now, now),
    env.DB.prepare("INSERT INTO admin_invitations (invitation_id,admin_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(randomToken(16), adminId, tokenHash, expires, now)
  ]);
  return json({ ok:true, admin:{admin_id:adminId,username,email,role:"admin"}, invitationToken:rawInvite, invitationUrl:`/admin/admin-invite.html?token=${encodeURIComponent(rawInvite)}`, expiresAt:expires });
}

async function getInvitation(request, env, token) {
  const tokenHash = await sha256Hex(token), now = Math.floor(Date.now()/1000);
  return env.DB.prepare(`SELECT i.invitation_id,i.admin_id,i.expires_at,i.used_at,a.username,a.email,a.enabled,a.totp_secret_enc,a.pending_secret_enc,a.pending_expires_at FROM admin_invitations i JOIN admin_accounts a ON a.admin_id=i.admin_id WHERE i.token_hash=?`).bind(tokenHash).first();
}

async function inviteInfo(request, env, url) {
  await ensureAuthSchema(env); const token = String(url.searchParams.get("token") || ""); if (!token) return json({error:"Invitation is missing."},400);
  const row = await getInvitation(request, env, token), now = Math.floor(Date.now()/1000);
  if (!row || row.used_at || Number(row.expires_at)<=now || !row.enabled) return json({error:"This invitation is invalid or expired."},410);
  return json({ok:true,username:row.username,email:row.email,configured:Boolean(row.totp_secret_enc),setupStarted:Boolean(row.pending_secret_enc),expiresAt:row.expires_at});
}

async function inviteSetupStart(request, env, url) {
  if (!sameOrigin(request,url)) return json({error:"Invalid origin."},403); await ensureAuthSchema(env);
  const body=await readJson(request), token=String(body?.token||""); if(!token)return json({error:"Invitation is missing."},400);
  const row=await getInvitation(request,env,token), now=Math.floor(Date.now()/1000);
  if(!row||row.used_at||Number(row.expires_at)<=now||!row.enabled)return json({error:"This invitation is invalid or expired."},410);
  if(row.totp_secret_enc)return json({error:"Authenticator is already configured. Sign in normally."},409);
  if(await rateLimited(env,`invite:${row.admin_id}`))return json({error:"Too many setup attempts. Try again later."},429);
  const secret=generateBase32Secret(), encrypted=await encryptSecret(secret,env.ADMIN_ENCRYPTION_KEY), pendingUntil=now+SETUP_TTL;
  await env.DB.prepare("UPDATE admin_accounts SET pending_secret_enc=?,pending_expires_at=?,updated_at=? WHERE admin_id=?").bind(encrypted,pendingUntil,now,row.admin_id).run();
  const otpauth=`otpauth://totp/${encodeURIComponent("MELO")}:${encodeURIComponent(row.username)}?secret=${secret}&issuer=${encodeURIComponent("MELO")}&algorithm=SHA1&digits=6&period=30`;
  const qr=qrcode(0,"M");qr.addData(otpauth);qr.make();const svg=qr.createSvgTag({cellSize:5,margin:4,scalable:true});
  return json({ok:true,username:row.username,qrCodeDataUrl:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`,setupKey:secret,expiresIn:SETUP_TTL});
}

async function inviteSetupVerify(request, env, url) {
  if (!sameOrigin(request,url)) return json({error:"Invalid origin."},403); await ensureAuthSchema(env);
  const body=await readJson(request), token=String(body?.token||""), code=String(body?.code||""); if(!token||!/^\d{6}$/.test(code))return json({error:"Enter the current 6-digit Authenticator code."},400);
  const row=await getInvitation(request,env,token), now=Math.floor(Date.now()/1000); if(!row||row.used_at||Number(row.expires_at)<=now||!row.enabled)return json({error:"This invitation is invalid or expired."},410);
  if(row.totp_secret_enc)return json({error:"Authenticator is already configured. Sign in normally."},409);
  if(!row.pending_secret_enc||!row.pending_expires_at||Number(row.pending_expires_at)<now)return json({error:"Authenticator setup expired. Start setup again."},410);
  let secret; try{secret=await decryptSecret(row.pending_secret_enc,env.ADMIN_ENCRYPTION_KEY)}catch{ return json({error:"Admin authentication is temporarily unavailable."},503); }
  if(!(await verifyTotp(secret,code)))return json({error:"Invalid or expired Authenticator code."},401);
  await env.DB.batch([
    env.DB.prepare("UPDATE admin_accounts SET totp_secret_enc=pending_secret_enc,pending_secret_enc=NULL,pending_expires_at=NULL,updated_at=?,last_login_at=? WHERE admin_id=?").bind(now,now,row.admin_id),
    env.DB.prepare("UPDATE admin_invitations SET used_at=? WHERE invitation_id=?").bind(now,row.invitation_id)
  ]);
  return createSessionResponse(env,row.admin_id);
}

async function administratorAction(request, env, url) {
  if (!sameOrigin(request,url))return json({error:"Invalid origin."},403); const auth=await requireOwner(request,env);if(auth.error)return auth.error;
  const parts=url.pathname.split("/").filter(Boolean), adminId=parts[parts.length-2], action=parts[parts.length-1]; if(!adminId||!action)return json({error:"Invalid administrator request."},400);
  const target=await env.DB.prepare("SELECT admin_id,username,role,enabled FROM admin_accounts WHERE admin_id=?").bind(adminId).first(); if(!target)return json({error:"Administrator not found."},404);
  if(target.role==="owner"||target.username===DEFAULT_OWNER_USERNAME)return json({error:"The Owner account cannot be changed here."},403);
  const now=Math.floor(Date.now()/1000);
  if(action==="disable") { await env.DB.prepare("UPDATE admin_accounts SET enabled=0,updated_at=? WHERE admin_id=?").bind(now,adminId).run(); await env.DB.prepare("DELETE FROM admin_identity_sessions WHERE admin_id=?").bind(adminId).run(); return json({ok:true}); }
  if(action==="enable") { await env.DB.prepare("UPDATE admin_accounts SET enabled=1,updated_at=? WHERE admin_id=?").bind(now,adminId).run(); return json({ok:true}); }
  if(action==="revoke-sessions") { await env.DB.prepare("DELETE FROM admin_identity_sessions WHERE admin_id=?").bind(adminId).run(); return json({ok:true}); }
  if(action==="reset-authenticator") {
    await env.DB.batch([
      env.DB.prepare("UPDATE admin_accounts SET totp_secret_enc=NULL,pending_secret_enc=NULL,pending_expires_at=NULL,updated_at=? WHERE admin_id=?").bind(now,adminId),
      env.DB.prepare("DELETE FROM admin_identity_sessions WHERE admin_id=?").bind(adminId),
      env.DB.prepare("UPDATE admin_invitations SET used_at=NULL,expires_at=? WHERE admin_id=? AND used_at IS NOT NULL ORDER BY created_at DESC LIMIT 1").bind(now+INVITE_TTL,adminId)
    ]);
    const rawInvite=randomToken(32),hash=await sha256Hex(rawInvite); await env.DB.prepare("INSERT INTO admin_invitations (invitation_id,admin_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)").bind(randomToken(16),adminId,hash,now+INVITE_TTL,now).run();
    return json({ok:true,invitationToken:rawInvite,invitationUrl:`/admin/admin-invite.html?token=${encodeURIComponent(rawInvite)}`,expiresAt:now+INVITE_TTL});
  }
  return json({error:"Unknown administrator action."},400);
}

async function rateLimited(env,key){const now=Math.floor(Date.now()/1000),row=await env.DB.prepare("SELECT window_start,count FROM admin_attempts WHERE key=?").bind(key).first();if(!row||now-Number(row.window_start)>=RATE_WINDOW){await env.DB.prepare("INSERT INTO admin_attempts (key,window_start,count) VALUES (?,?,1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1").bind(key,now).run();return false}if(Number(row.count)>=MAX_ATTEMPTS)return true;await env.DB.prepare("UPDATE admin_attempts SET count=count+1 WHERE key=?").bind(key).run();return false}
async function verifyTotp(secret,code){const now=Math.floor(Date.now()/1000);for(const offset of[-1,0,1])if(await totpForCounter(secret,Math.floor(now/30)+offset)===code)return true;return false}
async function totpForCounter(secret,counter){const key=await crypto.subtle.importKey("raw",base32Decode(secret),{name:"HMAC",hash:"SHA-1"},false,["sign"]);const buffer=new ArrayBuffer(8),view=new DataView(buffer);view.setUint32(0,Math.floor(counter/0x100000000));view.setUint32(4,counter>>>0);const digest=new Uint8Array(await crypto.subtle.sign("HMAC",key,buffer));const offset=digest[digest.length-1]&15;const binary=((digest[offset]&127)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3];return String(binary%1000000).padStart(6,"0")}
function base32Decode(value){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",clean=String(value).toUpperCase().replace(/=+$/g,"");let bits=0,buffer=0;const output=[];for(const char of clean){const index=alphabet.indexOf(char);if(index<0)throw new Error("Invalid Base32 secret");buffer=(buffer<<5)|index;bits+=5;if(bits>=8){bits-=8;output.push((buffer>>bits)&255)}}return new Uint8Array(output)}
function generateBase32Secret(bytes=20){const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567",random=new Uint8Array(bytes);crypto.getRandomValues(random);let buffer=0,bits=0,output="";for(const byte of random){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;output+=alphabet[(buffer>>bits)&31]}}if(bits)output+=alphabet[(buffer<<(5-bits))&31];return output}
async function encryptSecret(secret,encryptionKey){const key=await deriveKey(encryptionKey),iv=crypto.getRandomValues(new Uint8Array(12)),data=new TextEncoder().encode(secret),encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data));return `${toBase64(iv)}.${toBase64(encrypted)}`}
async function decryptSecret(value,encryptionKey){const[ivText,dataText]=String(value).split("."),key=await deriveKey(encryptionKey),plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64(ivText)},key,fromBase64(dataText));return new TextDecoder().decode(plaintext)}
async function deriveKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret||""));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"])}
async function sha256Hex(value){const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return[...digest].map(b=>b.toString(16).padStart(2,"0")).join("")}
function randomToken(bytes){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return toBase64Url(data)}
function toBase64(data){let binary="";for(const byte of data)binary+=String.fromCharCode(byte);return btoa(binary)}
function fromBase64(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0))}
function toBase64Url(data){return toBase64(data).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"")}
function normalizeEmail(value){return String(value||"").trim().toLowerCase()}
function normalizeUsername(value){const username=String(value||"").trim();return/^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(username)?username:""}
function isEmail(value){return/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)&&value.length<=254}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0}
function sameOrigin(request,url){const origin=request.headers.get("Origin");return!origin||origin===url.origin}
async function readJson(request){try{return await request.json()}catch{throw new Error("Invalid JSON request.")}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}})}
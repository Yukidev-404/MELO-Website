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
const RELEASE_STATUSES = new Set(["active", "staged", "archived"]);

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname.startsWith("/api/admin/")) return await handleApi(request, env, url);
      if (url.pathname.startsWith("/api/telemetry/")) return await handleTelemetry(request, env, url);
      if (url.pathname.startsWith("/api/bug-reports")) return await handleBugReports(request, env, url);
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

  if (url.pathname === "/api/admin/bug-reports" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return bugReportsData(env, url);
  }
  if (url.pathname === "/api/admin/bug-report" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return bugReportDetail(env, url);
  }
  if (url.pathname === "/api/admin/bug-report" && request.method === "PATCH") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return updateBugReport(request, env, url);
  }

  if (url.pathname === "/api/admin/installation" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    const installationId = url.searchParams.get("id") || "";
    if (!/^[A-Za-z0-9_-]{16,128}$/.test(installationId)) return json({ error: "Invalid installation ID." }, 400);
    const installation = await env.DB.prepare(`SELECT installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen, created_at, updated_at FROM installations WHERE installation_id = ?`).bind(installationId).first();
    if (!installation) return json({ error: "Installation not found." }, 404);
    const [events, crashes, credential] = await Promise.all([
      env.DB.prepare(`SELECT event_id, event_type, timestamp, app_version, build, platform, os_version, client_schema, created_at FROM telemetry_events WHERE installation_id = ? ORDER BY timestamp DESC LIMIT 500`).bind(installationId).all(),
      env.DB.prepare(`SELECT crash_id, event_id, error_type, message, stack_trace, severity, app_version, build, platform, os_version, timestamp, created_at FROM crash_reports WHERE installation_id = ? ORDER BY timestamp DESC LIMIT 100`).bind(installationId).all(),
      env.DB.prepare(`SELECT created_at, last_used_at, revoked_at FROM telemetry_credentials WHERE installation_id = ?`).bind(installationId).first()
    ]);
    return json({ ok: true, installation, events: events?.results || [], crashes: crashes?.results || [], telemetry: credential ? { active: !credential.revoked_at, createdAt: credential.created_at, lastUsedAt: credential.last_used_at, revokedAt: credential.revoked_at } : null });
  }

  if (url.pathname === "/api/admin/release-status" && request.method === "POST") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return updateReleaseStatus(request, env, url);
  }

  const protectedDataRoutes = new Set([
    "/api/admin/dashboard", "/api/admin/users", "/api/admin/installations", "/api/admin/crashes",
    "/api/admin/security", "/api/admin/services", "/api/admin/releases", "/api/admin/flags",
    "/api/admin/analytics", "/api/admin/health-detail", "/api/admin/settings"
  ]);
  if (protectedDataRoutes.has(url.pathname) && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return adminData(url.pathname, env, url);
  }
  return json({ error: "Not found." }, 404);
}

async function ensureBugReportsSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bug_reports (report_id TEXT PRIMARY KEY, installation_id TEXT, app_version TEXT NOT NULL, build TEXT, platform TEXT NOT NULL, os_version TEXT, client_schema INTEGER NOT NULL DEFAULT 1, what_happened TEXT NOT NULL, reproduction_steps TEXT, expected_result TEXT, status TEXT NOT NULL DEFAULT 'new', submitted_at INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, FOREIGN KEY (installation_id) REFERENCES installations(installation_id) ON DELETE SET NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bug_reports_submitted_at ON bug_reports(submitted_at)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bug_reports_installation ON bug_reports(installation_id)`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS bug_report_attachments (attachment_id TEXT PRIMARY KEY, report_id TEXT NOT NULL, filename TEXT NOT NULL, content_type TEXT, size_bytes INTEGER NOT NULL DEFAULT 0, storage_key TEXT, created_at INTEGER NOT NULL, FOREIGN KEY (report_id) REFERENCES bug_reports(report_id) ON DELETE CASCADE)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_bug_report_attachments_report ON bug_report_attachments(report_id)`)
  ]);
}

function bugReportJson(data, status=200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store', 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Headers':'Content-Type' } });
}

async function handleBugReports(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:{ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' } });
  if (request.method !== 'POST' || url.pathname !== '/api/bug-reports') return bugReportJson({ error:'Not found.' },404);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 128 * 1024) return bugReportJson({ error:'Bug report is too large.' },413);
  const now = Math.floor(Date.now()/1000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await ensureBugReportsSchema(env);
  const key = `bug-report:${ip}`;
  const rate = await env.DB.prepare('SELECT window_start,count FROM rate_limits WHERE key=?').bind(key).first();
  if (rate && now - Number(rate.window_start) < 600 && Number(rate.count) >= 5) return bugReportJson({ error:'Too many reports. Please try again later.' },429);
  if (!rate || now - Number(rate.window_start) >= 600) await env.DB.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1').bind(key,now).run();
  else await env.DB.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').bind(key).run();
  let body; try { body = await request.json(); } catch { return bugReportJson({ error:'Invalid JSON payload.' },400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bugReportJson({ error:'Invalid JSON payload.' },400);
  const installationId = body.installation_id == null ? null : String(body.installation_id);
  const appVersion = String(body.app_version || '').trim();
  const build = body.build == null ? '' : String(body.build).trim();
  const platform = String(body.platform || '').trim().toLowerCase();
  const osVersion = body.os_version == null ? '' : String(body.os_version).trim();
  const clientSchema = Number(body.client_schema ?? 1);
  const what = String(body.what_happened || '').trim();
  const repro = String(body.reproduction_steps || '').trim();
  const expected = String(body.expected_result || '').trim();
  if (!appVersion || appVersion.length > 64 || !/^\d{1,32}(?:\.\d{1,32}){0,3}$/.test(appVersion)) return bugReportJson({ error:'Invalid app_version.' },400);
  if (platform !== 'windows') return bugReportJson({ error:'Unsupported platform.' },400);
  if (!Number.isInteger(clientSchema) || clientSchema !== 1) return bugReportJson({ error:'Unsupported client_schema.' },400);
  if (!what || what.length > 16000 || repro.length > 16000 || expected.length > 16000) return bugReportJson({ error:'Bug report text is too large or missing.' },400);
  if (installationId && !/^[A-Za-z0-9_-]{16,128}$/.test(installationId)) return bugReportJson({ error:'Invalid installation_id.' },400);
  const reportId = `bug_${randomToken(18)}`;
  const attachments = Array.isArray(body.attachments) ? body.attachments.slice(0,100) : [];
  await env.DB.prepare(`INSERT INTO bug_reports (report_id,installation_id,app_version,build,platform,os_version,client_schema,what_happened,reproduction_steps,expected_result,status,submitted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'new',?,?,?)`).bind(reportId,installationId,appVersion,build||null,platform,osVersion||null,clientSchema,what,repro||null,expected||null,now,now,now).run();
  for (const a of attachments) {
    await env.DB.prepare('INSERT INTO bug_report_attachments (attachment_id,report_id,filename,content_type,size_bytes,storage_key,created_at) VALUES (?,?,?,?,?,?,?)').bind(`att_${randomToken(16)}`,reportId,String(a?.filename||'attachment').slice(0,255),String(a?.content_type||'application/octet-stream').slice(0,128),Math.max(0,Math.min(Number(a?.size_bytes||0),5*1024*1024)),a?.storage_key?String(a.storage_key).slice(0,512):null,now).run();
  }
  return bugReportJson({ok:true,report_id:reportId,received_at:now,attachment_count:attachments.length});
}

async function bugReportsData(env,url) {
  await ensureBugReportsSchema(env);
  const q=(url.searchParams.get('q')||'').trim().slice(0,128);
  const p=`%${q.replace(/[%_]/g,'\\$&')}%`;
  const result=q ? await env.DB.prepare(`SELECT report_id,installation_id,app_version,build,platform,os_version,status,submitted_at,what_happened,(SELECT COUNT(*) FROM bug_report_attachments a WHERE a.report_id=bug_reports.report_id) AS attachment_count FROM bug_reports WHERE report_id LIKE ? ESCAPE '\\' OR installation_id LIKE ? ESCAPE '\\' OR app_version LIKE ? ESCAPE '\\' OR what_happened LIKE ? ESCAPE '\\' ORDER BY submitted_at DESC LIMIT 200`).bind(p,p,p,p).all() : await env.DB.prepare(`SELECT report_id,installation_id,app_version,build,platform,os_version,status,submitted_at,what_happened,(SELECT COUNT(*) FROM bug_report_attachments a WHERE a.report_id=bug_reports.report_id) AS attachment_count FROM bug_reports ORDER BY submitted_at DESC LIMIT 200`).all();
  return json({ok:true,rows:result?.results||[]});
}

async function bugReportDetail(env,url) {
  await ensureBugReportsSchema(env);
  const id=url.searchParams.get('id')||'';
  if(!/^bug_[A-Za-z0-9_-]{16,64}$/.test(id)) return json({error:'Invalid report ID.'},400);
  const report=await env.DB.prepare('SELECT report_id,installation_id,app_version,build,platform,os_version,client_schema,what_happened,reproduction_steps,expected_result,status,submitted_at,created_at,updated_at FROM bug_reports WHERE report_id=?').bind(id).first();
  if(!report) return json({error:'Bug report not found.'},404);
  const attachments=await env.DB.prepare('SELECT attachment_id,filename,content_type,size_bytes,storage_key,created_at FROM bug_report_attachments WHERE report_id=? ORDER BY created_at ASC').bind(id).all();
  return json({ok:true,report,attachments:attachments?.results||[]});
}

async function updateBugReport(request,env,url) {
  await ensureBugReportsSchema(env);
  let body; try { body=await request.json(); } catch { return json({error:'Invalid JSON payload.'},400); }
  const id=String(body?.id||''), status=String(body?.status||'').toLowerCase();
  if(!/^bug_[A-Za-z0-9_-]{16,64}$/.test(id)) return json({error:'Invalid report ID.'},400);
  if(!['new','reviewing','resolved','wont_fix'].includes(status)) return json({error:'Invalid report status.'},400);
  const now=Math.floor(Date.now()/1000);
  const result=await env.DB.prepare('UPDATE bug_reports SET status=?,updated_at=? WHERE report_id=?').bind(status,now,id).run();
  if(!result?.meta?.changes) return json({error:'Bug report not found.'},404);
  return json({ok:true,report_id:id,status,updated_at:now});
}

async function updateReleaseStatus(request,env,url){
  if(!sameOrigin(request,url))return json({error:'Invalid origin.'},403);
  let body;try{body=await request.json();}catch{return json({error:'Invalid JSON request.'},400);}
  const version=String(body?.version||'').trim();
  const build=String(body?.build||'').trim();
  const platform=String(body?.platform||'').trim().toLowerCase();
  const status=String(body?.status||'').trim().toLowerCase();
  if(!version||version.length>64||!/^\d{1,32}(?:\.\d{1,32}){0,3}$/.test(version))return json({error:'Invalid release version.'},400);
  if(build.length>64)return json({error:'Invalid release build.'},400);
  if(!platform||platform.length>32)return json({error:'Invalid release platform.'},400);
  if(!RELEASE_STATUSES.has(status))return json({error:'Invalid release status.'},400);
  const now=Math.floor(Date.now()/1000);
  const match=build?await env.DB.prepare('SELECT version FROM releases WHERE version=? AND build=? AND platform=? LIMIT 1').bind(version,build,platform).first():await env.DB.prepare("SELECT version FROM releases WHERE version=? AND (build IS NULL OR build='') AND platform=? LIMIT 1").bind(version,platform).first();
  if(!match)return json({error:'Release not found.'},404);
  const statements=[];
  if(status==='active')statements.push(env.DB.prepare("UPDATE releases SET release_status='archived', updated_at=? WHERE platform=? AND release_status='active'").bind(now,platform));
  const target=build?env.DB.prepare('UPDATE releases SET release_status=?, updated_at=? WHERE version=? AND build=? AND platform=?').bind(status,now,version,build,platform):env.DB.prepare("UPDATE releases SET release_status=?, updated_at=? WHERE version=? AND (build IS NULL OR build='') AND platform=?").bind(status,now,version,platform);
  statements.push(target);
  await env.DB.batch(statements);
  return json({ok:true,version,build:build||null,platform,release_status:status,updated_at:now});
}

async function adminData(path, env, url) {
  const search = (url.searchParams.get("q") || "").trim().slice(0, 128);
  if (path === "/api/admin/dashboard") return dashboardData(env);
  if (path === "/api/admin/users") return installationsData(env, search);
  if (path === "/api/admin/installations") return installationsData(env, search);
  if (path === "/api/admin/crashes") return crashesData(env, search);
  if (path === "/api/admin/security") return securityData(env);
  if (path === "/api/admin/services") return servicesData(env);
  if (path === "/api/admin/releases") return releasesData(env);
  if (path === "/api/admin/flags") return flagsData(env);
  if (path === "/api/admin/analytics") return analyticsData(env);
  if (path === "/api/admin/health-detail") return healthData(env);
  if (path === "/api/admin/settings") return settingsData(env);
  return json({ error: "Not found." }, 404);
}

async function dashboardData(env) {
  const now = Math.floor(Date.now() / 1000);
  const dayStart = now - (now % 86400);
  const weekAgo = now - 7 * 86400;
  const [total, active, today, platforms, versions, latestRelease, crashesToday, unresolved, recent, failedAuth] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM installations").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM installations WHERE last_seen >= ?").bind(weekAgo).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM installations WHERE created_at >= ?").bind(dayStart).first(),
    env.DB.prepare("SELECT platform, COUNT(*) AS count FROM installations GROUP BY platform ORDER BY count DESC").all(),
    env.DB.prepare("SELECT app_version, COUNT(*) AS count FROM installations GROUP BY app_version ORDER BY count DESC LIMIT 10").all(),
    env.DB.prepare("SELECT version, build, release_status, released_at FROM releases ORDER BY released_at DESC LIMIT 1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM crash_reports WHERE timestamp >= ?").bind(dayStart).first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM crash_reports").first(),
    env.DB.prepare("SELECT event_id, event_type, installation_id, app_version, platform, timestamp FROM telemetry_events ORDER BY timestamp DESC LIMIT 8").all(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM admin_attempts WHERE key LIKE 'login:%' AND window_start >= ? AND count > 0").bind(now - RATE_WINDOW).first()
  ]);
  const currentVersion = latestRelease?.version || versions?.results?.[0]?.app_version || "—";
  const currentCount = versions?.results?.find(r => r.app_version === currentVersion)?.count || 0;
  const totalCount = Number(total?.count || 0);
  return json({ ok: true, metrics: { totalInstallations: totalCount, activeInstallations: Number(active?.count || 0), newToday: Number(today?.count || 0), suspendedUsers: 0 }, adoption: { platforms: platforms?.results || [], versions: versions?.results || [], currentVersion, currentBuild: latestRelease?.build || "—", currentReleaseStatus: latestRelease?.release_status || "not configured", currentAdoption: totalCount ? Math.round((Number(currentCount) / totalCount) * 100) : 0 }, recentActivity: recent?.results || [], crashes: { today: Number(crashesToday?.count || 0), total: Number(unresolved?.count || 0) }, security: { failedAuthWindows: Number(failedAuth?.count || 0) }, generatedAt: now });
}

async function installationsData(env, search) {
  const pattern = `%${search.replace(/[%_]/g, "\\$&")}%`;
  let result;
  if (search) result = await env.DB.prepare(`SELECT installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen FROM installations WHERE installation_id LIKE ? ESCAPE '\\' OR app_version LIKE ? ESCAPE '\\' OR build LIKE ? ESCAPE '\\' OR platform LIKE ? ESCAPE '\\' OR os_version LIKE ? ESCAPE '\\' ORDER BY last_seen DESC LIMIT 200`).bind(pattern, pattern, pattern, pattern, pattern).all();
  else result = await env.DB.prepare("SELECT installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen FROM installations ORDER BY last_seen DESC LIMIT 200").all();
  return json({ ok: true, rows: result?.results || [] });
}

async function crashesData(env, search) {
  let result;
  if (search) { const p = `%${search.replace(/[%_]/g, "\\$&")}%`; result = await env.DB.prepare(`SELECT crash_id, event_id, installation_id, error_type, message, stack_trace, severity, app_version, build, platform, os_version, timestamp FROM crash_reports WHERE crash_id LIKE ? ESCAPE '\\' OR installation_id LIKE ? ESCAPE '\\' OR error_type LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\' OR app_version LIKE ? ESCAPE '\\' ORDER BY timestamp DESC LIMIT 200`).bind(p,p,p,p,p).all(); }
  else result = await env.DB.prepare("SELECT crash_id, event_id, installation_id, error_type, message, stack_trace, severity, app_version, build, platform, os_version, timestamp FROM crash_reports ORDER BY timestamp DESC LIMIT 200").all();
  return json({ ok: true, rows: result?.results || [] });
}

async function securityData(env) {
  const now = Math.floor(Date.now() / 1000);
  const [attempts, config, sessions] = await Promise.all([
    env.DB.prepare("SELECT key, window_start, count FROM admin_attempts WHERE window_start >= ? ORDER BY window_start DESC LIMIT 100").bind(now - RATE_WINDOW).all(),
    env.DB.prepare("SELECT email, setup_complete, created_at, updated_at FROM admin_config WHERE id=1").first(),
    env.DB.prepare("SELECT COUNT(*) AS count FROM admin_sessions WHERE expires_at > ?").bind(now).first()
  ]);
  return json({ ok: true, attempts: attempts?.results || [], admin: { email: config?.email || ADMIN_EMAIL, setupComplete: Boolean(config?.setup_complete), activeSessions: Number(sessions?.count || 0) } });
}

async function servicesData(env) {
  const started = Date.now(); let db = { status: "DOWN", latencyMs: null };
  try { await env.DB.prepare("SELECT 1 AS ok").first(); db = { status: "OPERATIONAL", latencyMs: Date.now() - started }; } catch {}
  return json({ ok: true, services: [{ service: "MELO Worker", status: "OPERATIONAL", latencyMs: 0, note: "Current Worker request is responding." }, { service: "D1 Database", status: db.status, latencyMs: db.latencyMs, note: "melo-admin database connectivity." }, { service: "Telemetry API", status: "OPERATIONAL", latencyMs: 0, note: "Telemetry endpoints are deployed." }, { service: "Spotify API", status: "NOT MONITORED", latencyMs: null, note: "Spotify service monitoring is not connected yet." }] });
}

async function releasesData(env) { const result = await env.DB.prepare("SELECT version, build, platform, release_status, release_notes, released_at, created_at, updated_at FROM releases ORDER BY released_at DESC").all(); return json({ ok: true, rows: result?.results || [] }); }
async function flagsData(env) { const result = await env.DB.prepare("SELECT flag_key, enabled, description, updated_at, created_at FROM feature_flags ORDER BY flag_key").all(); return json({ ok: true, rows: result?.results || [] }); }

async function analyticsData(env) {
  const now = Math.floor(Date.now() / 1000);
  const [events, versions, platforms, daily] = await Promise.all([
    env.DB.prepare("SELECT event_type, COUNT(*) AS count FROM telemetry_events GROUP BY event_type ORDER BY count DESC").all(),
    env.DB.prepare("SELECT app_version, COUNT(*) AS count FROM installations GROUP BY app_version ORDER BY count DESC").all(),
    env.DB.prepare("SELECT platform, COUNT(*) AS count FROM installations GROUP BY platform ORDER BY count DESC").all(),
    env.DB.prepare("SELECT (created_at / 86400) AS day, COUNT(*) AS count FROM installations WHERE created_at >= ? GROUP BY day ORDER BY day DESC LIMIT 30").bind(now - 30 * 86400).all()
  ]);
  return json({ ok: true, events: events?.results || [], versions: versions?.results || [], platforms: platforms?.results || [], dailyInstallations: daily?.results || [] });
}

async function healthData(env) {
  const now = Math.floor(Date.now() / 1000);
  const [installations, events, crashes, lastEvent, lastCrash] = await Promise.all([
    env.DB.prepare("SELECT COUNT(*) AS count FROM installations").first(), env.DB.prepare("SELECT COUNT(*) AS count FROM telemetry_events").first(), env.DB.prepare("SELECT COUNT(*) AS count FROM crash_reports").first(), env.DB.prepare("SELECT timestamp, event_type FROM telemetry_events ORDER BY timestamp DESC LIMIT 1").first(), env.DB.prepare("SELECT timestamp, severity FROM crash_reports ORDER BY timestamp DESC LIMIT 1").first()
  ]);
  return json({ ok: true, checkedAt: now, components: [{ component: "Worker", status: "OPERATIONAL", detail: "Request handler active." }, { component: "D1", status: "OPERATIONAL", detail: `${Number(installations?.count || 0)} installations / ${Number(events?.count || 0)} events / ${Number(crashes?.count || 0)} crashes` }, { component: "Telemetry ingestion", status: "OPERATIONAL", detail: lastEvent ? `Last ${lastEvent.event_type} event recorded.` : "No telemetry events yet." }, { component: "Crash reporting", status: "OPERATIONAL", detail: lastCrash ? `Last ${lastCrash.severity} crash recorded.` : "No crash reports yet." }] });
}

async function settingsData(env) {
  const row = await env.DB.prepare("SELECT email, setup_complete, created_at, updated_at FROM admin_config WHERE id=1").first();
  return json({ ok: true, settings: [{ setting: "Authenticator 2FA", value: row?.setup_complete ? "Active" : "Not configured", status: row?.setup_complete ? "Protected" : "Action required" }, { setting: "Session TTL", value: `${SESSION_TTL / 3600} hours`, status: "Active" }, { setting: "Admin account", value: row?.email || ADMIN_EMAIL, status: "Protected" }, { setting: "Telemetry schema", value: "v1", status: "Active" }] });
}

async function handleTelemetry(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(request, url) });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  if (!sameOriginForTelemetry(request, url)) return json({ error: "Invalid origin." }, 403);
  const contentLength = Number(request.headers.get("Content-Length") || 0); if (contentLength > TELEMETRY_MAX_BODY) return json({ error: "Payload too large." }, 413);
  const body = await readJsonLimited(request, TELEMETRY_MAX_BODY); const validation = validateTelemetry(body); if (!validation.ok) return json({ error: validation.error }, 400);
  if (url.pathname === "/api/telemetry/install") return telemetryInstall(body, env, request);
  if (!["/api/telemetry/heartbeat", "/api/telemetry/version", "/api/telemetry/crash"].includes(url.pathname)) return json({ error: "Not found." }, 404);
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "").trim(); const auth = await authenticateTelemetry(token, env); if (!auth) return json({ error: "Invalid telemetry credential." }, 401);
  if (body.installation_id !== auth.installation_id) return json({ error: "Installation credential mismatch." }, 403);
  if (body.event_type !== url.pathname.split("/").pop()) return json({ error: "Event type does not match endpoint." }, 400);
  if (await telemetryRateLimited(env, auth.installation_id)) return json({ error: "Too many telemetry events. Try again later." }, 429);
  return recordTelemetry(body, env, auth);
}

async function telemetryInstall(body, env, request) {
  if (body.event_type !== "install") return json({ error: "Install endpoint requires event_type=install." }, 400);
  const ip = request.headers.get("CF-Connecting-IP") || "unknown"; if (await installRateLimited(env, ip)) return json({ error: "Too many installation requests. Try again later." }, 429);
  const existing = await env.DB.prepare("SELECT installation_id FROM installations WHERE installation_id = ?").bind(body.installation_id).first(); if (existing) return json({ error: "Installation is already registered." }, 409);
  const now = Math.floor(Date.now() / 1000); const credential = randomToken(32); const hash = await sha256Hex(credential);
  const statements = [env.DB.prepare(`INSERT INTO installations (installation_id, app_version, build, platform, os_version, client_schema, first_seen, last_seen, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.installation_id, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, body.timestamp, body.timestamp, now, now), env.DB.prepare(`INSERT INTO telemetry_events (event_id, installation_id, event_type, timestamp, app_version, build, platform, os_version, client_schema, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.event_id, body.installation_id, body.event_type, body.timestamp, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, now), env.DB.prepare(`INSERT INTO telemetry_credentials (installation_id, token_hash, created_at, last_used_at) VALUES (?, ?, ?, ?)` ).bind(body.installation_id, hash, now, now)];
  try { await env.DB.batch(statements); } catch (error) { if (String(error?.message || "").toLowerCase().includes("unique")) return json({ error: "Installation is already registered." }, 409); throw error; }
  return json({ ok: true, registered: true, telemetry_token: credential, installation_id: body.installation_id, server_time: now });
}

async function authenticateTelemetry(token, env) { if (!token || token.length < 32 || token.length > 256) return null; const tokenHash = await sha256Hex(token); const row = await env.DB.prepare("SELECT installation_id, token_hash, revoked_at FROM telemetry_credentials WHERE token_hash = ?").bind(tokenHash).first(); if (!row || row.revoked_at) return null; return row; }

function validateTelemetry(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { ok: false, error: "Invalid JSON payload." };
  const id = String(body.installation_id || ""); const eventId = String(body.event_id || ""); const type = String(body.event_type || ""); const timestamp = Number(body.timestamp); const version = String(body.app_version || ""); const build = body.build == null ? "" : String(body.build); const platform = String(body.platform || ""); const os = body.os_version == null ? "" : String(body.os_version); const schema = Number(body.client_schema);
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(id)) return { ok: false, error: "Invalid installation_id." }; if (!/^[A-Za-z0-9_-]{16,128}$/.test(eventId)) return { ok: false, error: "Invalid event_id." }; if (!ALLOWED_EVENT_TYPES.has(type)) return { ok: false, error: "Invalid event_type." }; if (!Number.isInteger(timestamp) || timestamp < 1 || timestamp > Math.floor(Date.now() / 1000) + 300) return { ok: false, error: "Invalid timestamp." }; if (!/^\d{1,32}(?:\.\d{1,32}){0,3}$/.test(version) || version.length > 64) return { ok: false, error: "Invalid app_version." }; if (build.length > 64 || platform.length > 32 || os.length > 128) return { ok: false, error: "Telemetry field too long." }; if (!ALLOWED_PLATFORMS.has(platform)) return { ok: false, error: "Unsupported platform." }; if (!Number.isInteger(schema) || schema !== 1) return { ok: false, error: "Unsupported client_schema." };
  if (type === "crash") { const crash = body.crash; if (!crash || typeof crash !== "object" || Array.isArray(crash)) return { ok: false, error: "Invalid crash payload." }; if (String(crash.error_type || "").length > 128 || String(crash.message || "").length > 4096 || String(crash.stack_trace || "").length > 16384) return { ok: false, error: "Crash payload too large." }; if (!["error", "fatal", "warning"].includes(String(crash.severity || "error"))) return { ok: false, error: "Invalid crash severity." }; }
  return { ok: true };
}

async function recordTelemetry(body, env, auth) {
  const now = Math.floor(Date.now() / 1000);
  const crashId = body.event_type === "crash" ? randomToken(18) : null;
  const statements = [
    env.DB.prepare(`INSERT INTO telemetry_events (event_id, installation_id, event_type, timestamp, app_version, build, platform, os_version, client_schema, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(body.event_id, body.installation_id, body.event_type, body.timestamp, body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, now),
    env.DB.prepare(`UPDATE installations SET app_version=?, build=?, platform=?, os_version=?, client_schema=?, last_seen=?, updated_at=? WHERE installation_id=?`).bind(body.app_version, body.build || null, body.platform, body.os_version || null, body.client_schema, body.timestamp, now, body.installation_id),
    env.DB.prepare("UPDATE telemetry_credentials SET last_used_at = ? WHERE installation_id = ? AND revoked_at IS NULL").bind(now, auth.installation_id)
  ];
  if (body.event_type === "crash") {
    const crash = body.crash;
    statements.push(env.DB.prepare(`INSERT INTO crash_reports (crash_id, event_id, installation_id, error_type, message, stack_trace, severity, app_version, build, platform, os_version, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(crashId, body.event_id, body.installation_id, sanitizeText(crash.error_type, 128), sanitizeText(crash.message, 4096), sanitizeStack(crash.stack_trace, 16384), crash.severity || "error", body.app_version, body.build || null, body.platform, body.os_version || null, body.timestamp, now));
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (String(error?.message || "").toLowerCase().includes("unique")) return json({ ok: true, duplicate: true });
    throw error;
  }
  return json({ ok: true, recorded: true });
}
async function telemetryRateLimited(env, installationId) { const key = `telemetry:${installationId}`; const now = Math.floor(Date.now() / 1000); const row = await env.DB.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").bind(key).first(); if (!row || now - row.window_start >= TELEMETRY_RATE_WINDOW) { await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start, count=1").bind(key, now).run(); return false; } if (row.count >= TELEMETRY_MAX_EVENTS) return true; await env.DB.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").bind(key).run(); return false; }
async function installRateLimited(env, ip) { const key = `telemetry-install:${ip}`; const now = Math.floor(Date.now() / 1000); const window = 10 * 60; const max = 10; const row = await env.DB.prepare("SELECT window_start, count FROM rate_limits WHERE key = ?").bind(key).first(); if (!row || now - row.window_start >= window) { await env.DB.prepare("INSERT INTO rate_limits (key, window_start, count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start, count=1").bind(key, now).run(); return false; } if (row.count >= max) return true; await env.DB.prepare("UPDATE rate_limits SET count=count+1 WHERE key=?").bind(key).run(); return false; }
function sanitizeText(value, max) { return String(value || "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").slice(0, max).replace(/(?:Bearer\s+)[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED]").replace(/(?:access[_ -]?token|refresh[_ -]?token|api[_ -]?key|password|secret)\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]").replace(/([A-Za-z]:\\Users\\)[^\\]+/gi, "$1[REDACTED]").replace(/(\/Users\/|\/home\/)[^\/]+/gi, "$1[REDACTED]"); }
function sanitizeStack(value, max) { return sanitizeText(value, max); }

async function setupStart(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); const body = await readJson(request); const email = normalizeEmail(body.email); const token = request.headers.get("X-MELO-Setup-Token") || ""; if (email !== ADMIN_EMAIL || !token || !timingSafeEqual(token, env.ADMIN_SETUP_TOKEN || "")) return json({ error: "Unauthorized setup request." }, 403); const existing = await env.DB.prepare("SELECT setup_complete, totp_secret_enc FROM admin_config WHERE id = 1").first(); if (existing?.setup_complete || existing?.totp_secret_enc) return json({ error: "Admin setup is already complete." }, 409); if (await rateLimited(env, `setup:${email}`)) return json({ error: "Too many setup attempts. Try again later." }, 429); const secret = generateBase32Secret(); const now = Math.floor(Date.now() / 1000); const encrypted = await encryptSecret(secret, env.ADMIN_ENCRYPTION_KEY); const pendingUntil = now + SETUP_TTL; await env.DB.prepare(`INSERT INTO admin_config (id, email, pending_secret_enc, pending_expires_at, setup_complete, created_at, updated_at) VALUES (1, ?, ?, ?, 0, ?, ?) ON CONFLICT(id) DO UPDATE SET email=excluded.email, pending_secret_enc=excluded.pending_secret_enc, pending_expires_at=excluded.pending_expires_at, updated_at=excluded.updated_at`).bind(ADMIN_EMAIL, encrypted, pendingUntil, now, now).run(); const otpauth = `otpauth://totp/${encodeURIComponent("MELO")}:${encodeURIComponent(ADMIN_EMAIL)}?secret=${secret}&issuer=${encodeURIComponent("MELO")}&algorithm=SHA1&digits=6&period=30`; const qr = qrcode(0, "M"); qr.addData(otpauth); qr.make(); const svg = qr.createSvgTag({ cellSize: 5, margin: 4, scalable: true }); const qrCodeDataUrl = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`; return json({ setupKey: secret, qrCodeDataUrl, expiresIn: SETUP_TTL }); }
async function setupVerify(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); return completeSetupOrLogin(request, env, url, await readJson(request), true); }
async function login(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); return completeSetupOrLogin(request, env, url, await readJson(request), false); }
async function completeSetupOrLogin(request, env, url, body, isSetup) { const email = normalizeEmail(body.email); const code = String(body.code || ""); if (email !== ADMIN_EMAIL || !/^\d{6}$/.test(code)) return json({ error: "Invalid administrator credentials." }, 401); if (await rateLimited(env, `login:${email}`)) return json({ error: "Too many attempts. Try again later." }, 429); const row = await env.DB.prepare("SELECT * FROM admin_config WHERE id = 1").first(); if (!row || row.email !== ADMIN_EMAIL) return json({ error: "Admin setup has not been initialized." }, 409); let secret; if (isSetup) { if (row.setup_complete || row.totp_secret_enc) return json({ error: "Setup is already complete. Use normal login." }, 409); if (!row.pending_secret_enc || !row.pending_expires_at || row.pending_expires_at < Math.floor(Date.now() / 1000)) return json({ error: "Setup expired. Start authenticator setup again." }, 410); secret = await decryptSecret(row.pending_secret_enc, env.ADMIN_ENCRYPTION_KEY); } else { if (!row.totp_secret_enc) return json({ error: "Complete Authenticator setup first." }, 409); secret = await decryptSecret(row.totp_secret_enc, env.ADMIN_ENCRYPTION_KEY); } if (!(await verifyTotp(secret, code))) return json({ error: "Invalid or expired Authenticator code." }, 401); const now = Math.floor(Date.now() / 1000); if (isSetup) await env.DB.prepare(`UPDATE admin_config SET totp_secret_enc=pending_secret_enc, pending_secret_enc=NULL, pending_expires_at=NULL, setup_complete=1, updated_at=? WHERE id=1`).bind(now).run(); else if (!row.setup_complete) await env.DB.prepare("UPDATE admin_config SET setup_complete=1, updated_at=? WHERE id=1").bind(now).run(); await env.DB.prepare("DELETE FROM admin_attempts WHERE key=?").bind(`login:${email}`).run(); return createSessionResponse(env, url.origin); }
async function createSessionResponse(env, origin) { const raw = randomToken(32); const hash = await sha256Hex(raw); const now = Math.floor(Date.now() / 1000); const expires = now + SESSION_TTL; await env.DB.prepare("INSERT INTO admin_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)").bind(hash, now, expires).run(); const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" }); headers.append("Set-Cookie", `${SESSION_COOKIE}=${raw}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; Secure; SameSite=Strict`); return new Response(JSON.stringify({ ok: true, redirect: "/admin/" }), { status: 200, headers }); }
async function getSession(request, env) { const cookie = request.headers.get("Cookie") || ""; const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)); if (!match) return null; const hash = await sha256Hex(match[1]); const row = await env.DB.prepare("SELECT token_hash, expires_at FROM admin_sessions WHERE token_hash=?").bind(hash).first(); if (!row) return null; if (row.expires_at <= Math.floor(Date.now() / 1000)) { await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(hash).run(); return null; } return row; }
async function me(request, env, url) { const session = await getSession(request, env); if (!session) return json({ authenticated: false }, 401); return json({ authenticated: true, email: ADMIN_EMAIL, expiresAt: session.expires_at }); }
async function logout(request, env, url) { if (!sameOrigin(request, url)) return json({ error: "Invalid origin." }, 403); const cookie = request.headers.get("Cookie") || ""; const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`)); if (match) { const hash = await sha256Hex(match[1]); await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash=?").bind(hash).run(); } const headers = new Headers({ "Content-Type": "application/json", "Cache-Control": "no-store" }); headers.set("Set-Cookie", `${SESSION_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Strict`); return new Response(JSON.stringify({ ok: true }), { status: 200, headers }); }
async function rateLimited(env, key) { const now = Math.floor(Date.now() / 1000); const row = await env.DB.prepare("SELECT window_start,count FROM admin_attempts WHERE key=?").bind(key).first(); if (!row || now - row.window_start >= RATE_WINDOW) { await env.DB.prepare("INSERT INTO admin_attempts (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1").bind(key, now).run(); return false; } if (row.count >= MAX_ATTEMPTS) return true; await env.DB.prepare("UPDATE admin_attempts SET count=count+1 WHERE key=?").bind(key).run(); return false; }
async function verifyTotp(secret, code) { const now = Math.floor(Date.now() / 1000); for (const offset of [-1,0,1]) if (await totpForCounter(secret, Math.floor(now/30)+offset) === code) return true; return false; }
async function totpForCounter(secret, counter) { const key = await crypto.subtle.importKey("raw", base32Decode(secret), { name:"HMAC", hash:"SHA-1" }, false, ["sign"]); const buffer = new ArrayBuffer(8); const view = new DataView(buffer); view.setUint32(0, Math.floor(counter/0x100000000)); view.setUint32(4, counter >>> 0); const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, buffer)); const offset = digest[digest.length-1] & 0x0f; const binary = ((digest[offset]&0x7f)<<24)|(digest[offset+1]<<16)|(digest[offset+2]<<8)|digest[offset+3]; return String(binary%1000000).padStart(6,"0"); }
function base32Decode(value) { const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; const clean=value.toUpperCase().replace(/=+$/g,""); let bits=0,buffer=0; const output=[]; for (const char of clean) { const index=alphabet.indexOf(char); if(index<0) throw new Error("Invalid Base32 secret"); buffer=(buffer<<5)|index; bits+=5; if(bits>=8){bits-=8;output.push((buffer>>bits)&0xff);} } return new Uint8Array(output); }
function generateBase32Secret(bytes=20) { const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; const random=new Uint8Array(bytes); crypto.getRandomValues(random); let buffer=0,bits=0,output=""; for(const byte of random){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;output+=alphabet[(buffer>>bits)&31];}} if(bits) output+=alphabet[(buffer<<(5-bits))&31]; return output; }
async function encryptSecret(secret,encryptionKey){const key=await deriveKey(encryptionKey);const iv=crypto.getRandomValues(new Uint8Array(12));const data=new TextEncoder().encode(secret);const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:"AES-GCM",iv},key,data));return `${toBase64(iv)}.${toBase64(encrypted)}`;}
async function decryptSecret(value,encryptionKey){const [ivText,dataText]=String(value).split(".");const key=await deriveKey(encryptionKey);const plaintext=await crypto.subtle.decrypt({name:"AES-GCM",iv:fromBase64(ivText)},key,fromBase64(dataText));return new TextDecoder().decode(plaintext);}
async function deriveKey(secret){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(secret||""));return crypto.subtle.importKey("raw",digest,{name:"AES-GCM"},false,["encrypt","decrypt"]);}
async function sha256Hex(value){const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value)));return [...digest].map(b=>b.toString(16).padStart(2,"0")).join("");}
function randomToken(bytes){const data=new Uint8Array(bytes);crypto.getRandomValues(data);return toBase64Url(data);}
function toBase64(data){let binary="";for(const byte of data)binary+=String.fromCharCode(byte);return btoa(binary);}
function fromBase64(value){const binary=atob(value);return Uint8Array.from(binary,c=>c.charCodeAt(0));}
function toBase64Url(data){return toBase64(data).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/g,"");}
function normalizeEmail(value){return String(value||"").trim().toLowerCase();}
function timingSafeEqual(a,b){if(a.length!==b.length)return false;let result=0;for(let i=0;i<a.length;i++)result|=a.charCodeAt(i)^b.charCodeAt(i);return result===0;}
function sameOrigin(request,url){const origin=request.headers.get("Origin");return !origin||origin===url.origin;}
function sameOriginForTelemetry(request,url){const origin=request.headers.get("Origin");return !origin||origin===url.origin;}
async function readJson(request){try{return await request.json();}catch{throw new Error("Invalid JSON request.");}}
async function readJsonLimited(request,maxBytes){const text=await request.text();if(new TextEncoder().encode(text).byteLength>maxBytes)throw new Error("Payload too large.");try{return JSON.parse(text);}catch{throw new Error("Invalid JSON payload.");}}
function corsHeaders(request,url){const origin=request.headers.get("Origin");const headers={"Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type, Authorization, X-MELO-Setup-Token"};if(origin===url.origin)headers["Access-Control-Allow-Origin"]=origin;return headers;}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});}
function withSecurityHeaders(response){const headers=new Headers(response.headers);headers.set("X-Content-Type-Options","nosniff");headers.set("Referrer-Policy","strict-origin-when-cross-origin");headers.set("X-Frame-Options","DENY");return new Response(response.body,{status:response.status,statusText:response.statusText,headers});}

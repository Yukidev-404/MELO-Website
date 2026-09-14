const SESSION_COOKIE = 'melo_admin_session';
const OWNER = 'owner';
const OWNER_NAME = 'Yuki';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/admin/')) return null;
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    if (['POST','PATCH','DELETE'].includes(request.method) && !sameOrigin(request, url)) return json({error:'Invalid origin.'},403);
    if (url.pathname === '/api/admin/audit-log' && request.method === 'GET') return auditList(env, url);
    if (url.pathname === '/api/admin/flag' && request.method === 'POST') return flagMutation(request, env, session);
    if (url.pathname === '/api/admin/crash/status' && request.method === 'POST') return crashStatus(request, env, session);
    if (url.pathname === '/api/admin/release-status' && request.method === 'POST') return releaseMutation(request, env, session);
    return null;
  }
};

async function getSession(request, env) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const hash = await sha256(match[1]);
  const row = await env.DB.prepare(`SELECT s.token_hash,s.expires_at,a.admin_id,a.username,a.email,a.role FROM admin_identity_sessions s JOIN admin_accounts a ON a.admin_id=s.admin_id WHERE s.token_hash=? AND a.enabled=1`).bind(hash).first();
  if (!row || Number(row.expires_at) <= Math.floor(Date.now()/1000)) return null;
  return row;
}

async function ensureAuditSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS admin_audit_log (audit_id TEXT PRIMARY KEY,admin_id TEXT,username TEXT,role TEXT,action TEXT NOT NULL,resource_type TEXT NOT NULL,resource_id TEXT,details_json TEXT,ip_address TEXT,created_at INTEGER NOT NULL)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_log(admin_id,created_at DESC)`),
    env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_admin_audit_resource ON admin_audit_log(resource_type,resource_id,created_at DESC)`)
  ]);
}

async function audit(env, session, request, action, resourceType, resourceId, details={}) {
  try {
    await ensureAuditSchema(env);
    const now = Math.floor(Date.now()/1000);
    const ip = String(request.headers.get('CF-Connecting-IP') || '').slice(0,64) || null;
    await env.DB.prepare(`INSERT INTO admin_audit_log (audit_id,admin_id,username,role,action,resource_type,resource_id,details_json,ip_address,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(`audit_${randomToken(14)}`,session?.admin_id||null,session?.username||null,session?.role||null,action,resourceType,resourceId ? String(resourceId).slice(0,256) : null,JSON.stringify(details||{}).slice(0,4000),ip,now).run();
  } catch (error) { console.error('MELO audit write failed', error); }
}

async function auditList(env, url) {
  await ensureAuditSchema(env);
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 100)));
  const q = String(url.searchParams.get('q') || '').trim().slice(0,128);
  const type = String(url.searchParams.get('type') || '').trim().slice(0,64);
  let result;
  if (q && type) {
    const p = `%${q.replace(/[%_]/g,'\\$&')}%`;
    result = await env.DB.prepare(`SELECT audit_id,admin_id,username,role,action,resource_type,resource_id,details_json,created_at FROM admin_audit_log WHERE resource_type=? AND (username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR resource_id LIKE ? ESCAPE '\\' OR details_json LIKE ? ESCAPE '\\') ORDER BY created_at DESC LIMIT ?`).bind(type,p,p,p,p,limit).all();
  } else if (q) {
    const p = `%${q.replace(/[%_]/g,'\\$&')}%`;
    result = await env.DB.prepare(`SELECT audit_id,admin_id,username,role,action,resource_type,resource_id,details_json,created_at FROM admin_audit_log WHERE username LIKE ? ESCAPE '\\' OR action LIKE ? ESCAPE '\\' OR resource_type LIKE ? ESCAPE '\\' OR resource_id LIKE ? ESCAPE '\\' OR details_json LIKE ? ESCAPE '\\' ORDER BY created_at DESC LIMIT ?`).bind(p,p,p,p,p,limit).all();
  } else if (type) {
    result = await env.DB.prepare(`SELECT audit_id,admin_id,username,role,action,resource_type,resource_id,details_json,created_at FROM admin_audit_log WHERE resource_type=? ORDER BY created_at DESC LIMIT ?`).bind(type,limit).all();
  } else {
    result = await env.DB.prepare(`SELECT audit_id,admin_id,username,role,action,resource_type,resource_id,details_json,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT ?`).bind(limit).all();
  }
  return json({ok:true,rows:(result?.results||[]).map(r=>({...r,details:parseJson(r.details_json)}))});
}

async function flagMutation(request, env, session) {
  if (session.role !== OWNER) return json({error:'Owner access required for feature flag changes.'},403);
  let body; try { body = await request.json(); } catch { return json({error:'Invalid JSON payload.'},400); }
  const key = String(body?.flag_key || '').trim();
  const enabled = body?.enabled === true || body?.enabled === 1 || String(body?.enabled).toLowerCase() === 'true';
  const description = String(body?.description || '').trim().slice(0,1000);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,127}$/.test(key)) return json({error:'Invalid feature flag key.'},400);
  await ensureFlagSchema(env);
  const before = await env.DB.prepare('SELECT flag_key,enabled,description FROM feature_flags WHERE flag_key=?').bind(key).first();
  const now = Math.floor(Date.now()/1000);
  if (before) await env.DB.prepare('UPDATE feature_flags SET enabled=?,description=?,updated_at=? WHERE flag_key=?').bind(enabled?1:0,description || before.description || null,now,key).run();
  else await env.DB.prepare('INSERT INTO feature_flags (flag_key,description,enabled,created_at,updated_at) VALUES (?,?,?,?,?)').bind(key,description||null,enabled?1:0,now,now).run();
  await audit(env,session,request,enabled?'flag.enable':'flag.disable','feature_flag',key,{beforeEnabled:Number(before?.enabled||0),afterEnabled:enabled?1:0});
  const row = await env.DB.prepare('SELECT flag_key,description,enabled,created_at,updated_at FROM feature_flags WHERE flag_key=?').bind(key).first();
  return json({ok:true,row});
}
async function ensureFlagSchema(env) { await env.DB.prepare(`CREATE TABLE IF NOT EXISTS feature_flags (flag_key TEXT PRIMARY KEY,description TEXT,enabled INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL)`).run(); }
async function crashStatus(request, env, session) {
  let body; try { body = await request.json(); } catch { return json({error:'Invalid JSON payload.'},400); }
  const id=String(body?.id||'').trim(),status=String(body?.status||'').trim().toLowerCase();
  if(!id||id.length>128)return json({error:'Invalid crash ID.'},400);if(!['unresolved','investigating','resolved','wont_fix'].includes(status))return json({error:'Invalid crash status.'},400);
  await ensureCrashSchema(env);const before=await env.DB.prepare('SELECT status FROM crash_reports WHERE crash_id=?').bind(id).first();if(!before)return json({error:'Crash report not found.'},404);const now=Math.floor(Date.now()/1000);await env.DB.prepare(`UPDATE crash_reports SET status=?,resolved_at=? WHERE crash_id=?`).bind(status,status==='resolved'?now:null,id).run();await audit(env,session,request,`crash.${status}`,'crash',id,{beforeStatus:String(before.status||'unresolved'),afterStatus:status});return json({ok:true,crash_id:id,status});
}
async function ensureCrashSchema(env){try{await env.DB.prepare("ALTER TABLE crash_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'unresolved'").run()}catch(e){if(!/duplicate column|already exists/i.test(String(e?.message||'')))throw e}try{await env.DB.prepare("ALTER TABLE crash_reports ADD COLUMN resolved_at INTEGER").run()}catch(e){if(!/duplicate column|already exists/i.test(String(e?.message||'')))throw e}}
async function releaseMutation(request, env, session) {
  if(session.role!==OWNER)return json({error:'Owner access required for release rollout changes.'},403);let body;try{body=await request.json()}catch{return json({error:'Invalid JSON payload.'},400)}const version=String(body?.version||'').trim(),build=String(body?.build||'').trim(),platform=String(body?.platform||'').trim().toLowerCase(),status=String(body?.status||'').trim().toLowerCase();if(!version||!platform||!['active','staged','archived'].includes(status))return json({error:'Invalid release change.'},400);const now=Math.floor(Date.now()/1000);const before=await env.DB.prepare('SELECT release_status FROM releases WHERE version=? AND build=? AND platform=? ORDER BY updated_at DESC LIMIT 1').bind(version,build,platform).first();if(!before)return json({error:'Release not found.'},404);if(status==='active')await env.DB.prepare("UPDATE releases SET release_status='archived',updated_at=? WHERE platform=? AND release_status='active' AND NOT(version=? AND build=?)").bind(now,platform,version,build).run();await env.DB.prepare('UPDATE releases SET release_status=?,updated_at=? WHERE version=? AND build=? AND platform=?').bind(status,now,version,build,platform).run();await audit(env,session,request,`release.${status}`,'release',`${platform}:${version}:${build}`,{beforeStatus:String(before.release_status||''),afterStatus:status});return json({ok:true,version,build,platform,status});
}
function sameOrigin(request,url){const origin=request.headers.get('Origin');return !origin||origin===url.origin}
function parseJson(v){try{return v?JSON.parse(v):{}}catch{return {raw:String(v)}}}
async function sha256(value){const d=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)));return [...d].map(b=>b.toString(16).padStart(2,'0')).join('')}
function randomToken(bytes=16){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}})}

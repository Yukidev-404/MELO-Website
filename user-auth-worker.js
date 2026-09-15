const COOKIE = 'melo_user_session';
const SESSION_DAYS = 30;
const ITERATIONS = 120000;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/auth/')) return new Response('Not found', { status: 404 });
    try {
      await ensureSchema(env);
      if (request.method === 'POST' && url.pathname === '/api/auth/signup') return signup(request, env);
      if (request.method === 'POST' && url.pathname === '/api/auth/login') return login(request, env);
      if (request.method === 'POST' && url.pathname === '/api/auth/logout') return logout(request, env);
      if (request.method === 'GET' && url.pathname === '/api/auth/me') return me(request, env);
      return json({ error: 'Method not allowed.' }, 405);
    } catch (error) {
      console.error('MELO user auth error', error);
      return json({ error: 'Authentication service error. Please try again.' }, 500);
    }
  }
};

async function ensureSchema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_accounts (
      user_id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )`),
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS user_sessions (
      session_hash TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL
    )`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON user_sessions(user_id)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_user_sessions_expiry ON user_sessions(expires_at)')
  ]);
}

async function signup(request, env) {
  const body = await readBody(request);
  const name = cleanName(body?.name);
  const email = cleanEmail(body?.email);
  const password = String(body?.password || '');
  if (name.length < 2 || name.length > 60) return json({ error: 'Enter a valid name.' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return json({ error: 'Enter a valid email address.' }, 400);
  if (password.length < 8 || password.length > 128) return json({ error: 'Password must be 8–128 characters.' }, 400);
  const exists = await env.DB.prepare('SELECT user_id FROM user_accounts WHERE email=?').bind(email).first();
  if (exists) return json({ error: 'An account with that email already exists.' }, 409);
  const salt = randomHex(16);
  const hash = await passwordHash(password, salt);
  const id = 'usr_' + randomHex(12);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare('INSERT INTO user_accounts (user_id,email,display_name,password_hash,password_salt,created_at,updated_at) VALUES (?,?,?,?,?,?,?)').bind(id,email,name,hash,salt,now,now).run();
  return createSession(env, { user_id:id, email, display_name:name }, request);
}

async function login(request, env) {
  const body = await readBody(request);
  const email = cleanEmail(body?.email);
  const password = String(body?.password || '');
  if (!email || !password) return json({ error: 'Enter your email and password.' }, 400);
  const account = await env.DB.prepare('SELECT user_id,email,display_name,password_hash,password_salt FROM user_accounts WHERE email=?').bind(email).first();
  if (!account) return json({ error: 'Invalid email or password.' }, 401);
  const hash = await passwordHash(password, account.password_salt);
  if (!constantTime(hash, account.password_hash)) return json({ error: 'Invalid email or password.' }, 401);
  return createSession(env, { user_id:account.user_id, email:account.email, display_name:account.display_name }, request);
}

async function logout(request, env) {
  const token = readCookie(request.headers.get('Cookie'), COOKIE);
  if (token) await env.DB.prepare('DELETE FROM user_sessions WHERE session_hash=?').bind(await sha256(token)).run();
  return new Response(JSON.stringify({ ok:true }), { status:200, headers:{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':`${COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`} });
}

async function me(request, env) {
  const account = await currentUser(request, env);
  if (!account) return json({ authenticated:false }, 401);
  return json({ authenticated:true, user:account });
}

async function currentUser(request, env) {
  const token = readCookie(request.headers.get('Cookie'), COOKIE);
  if (!token) return null;
  const hash = await sha256(token);
  const row = await env.DB.prepare(`SELECT u.user_id,u.email,u.display_name,s.expires_at FROM user_sessions s JOIN user_accounts u ON u.user_id=s.user_id WHERE s.session_hash=?`).bind(hash).first();
  if (!row) return null;
  if (Number(row.expires_at) <= Math.floor(Date.now()/1000)) { await env.DB.prepare('DELETE FROM user_sessions WHERE session_hash=?').bind(hash).run(); return null; }
  return { user_id:row.user_id, email:row.email, display_name:row.display_name };
}

async function createSession(env, user, request) {
  const token = randomHex(32);
  const now = Math.floor(Date.now()/1000);
  const expires = now + SESSION_DAYS * 86400;
  await env.DB.prepare('INSERT INTO user_sessions (session_hash,user_id,expires_at,created_at) VALUES (?,?,?,?)').bind(await sha256(token),user.user_id,expires,now).run();
  const headers = new Headers({'Content-Type':'application/json','Cache-Control':'no-store'});
  headers.set('Set-Cookie', `${COOKIE}=${token}; Max-Age=${SESSION_DAYS*86400}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  return new Response(JSON.stringify({ok:true,user}), {status:200,headers});
}

async function passwordHash(password, saltHex) {
  const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({name:'PBKDF2',salt:hexBytes(saltHex),iterations:ITERATIONS,hash:'SHA-256'}, baseKey, 256);
  return bytesHex(new Uint8Array(bits));
}
async function sha256(value) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)); return bytesHex(new Uint8Array(d)); }
function randomHex(bytes){const a=new Uint8Array(bytes);crypto.getRandomValues(a);return bytesHex(a)}
function bytesHex(a){return [...a].map(b=>b.toString(16).padStart(2,'0')).join('')}
function hexBytes(hex){const a=new Uint8Array(hex.length/2);for(let i=0;i<a.length;i++)a[i]=parseInt(hex.slice(i*2,i*2+2),16);return a}
function constantTime(a,b){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0}
function cleanEmail(v){return String(v||'').trim().toLowerCase()}
function cleanName(v){return String(v||'').trim().replace(/\s+/g,' ')}
function readCookie(header,name){const match=String(header||'').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));return match?decodeURIComponent(match[1]):null}
async function readBody(request){try{return await request.json()}catch{return {}}}
function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}})}

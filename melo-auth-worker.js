const SESSION_COOKIE = 'melo_session';
const SESSION_TTL = 60 * 60 * 24 * 30;
const OAUTH_STATE_TTL = 10 * 60;
const PBKDF2_ITERATIONS = 210000;
const PROVIDERS = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile' },
  github: { authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email' },
  microsoft: { authorize: 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize', token: 'https://login.microsoftonline.com/common/oauth2/v2.0/token', scope: 'openid profile email' }
};

const json = (body, status = 200, extra = {}) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra }
});
const now = () => Math.floor(Date.now() / 1000);
const id = () => crypto.randomUUID();

function bytesToBase64(bytes) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}
function base64ToBytes(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '==='.slice((value.length + 3) % 4);
  return Uint8Array.from(atob(padded), char => char.charCodeAt(0));
}
async function digest(value) {
  const data = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  return bytesToBase64(new Uint8Array(await crypto.subtle.digest('SHA-256', data)));
}
async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: base64ToBytes(salt), iterations, hash: 'SHA-256' }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function randomToken(size = 32) { return bytesToBase64(crypto.getRandomValues(new Uint8Array(size))); }
function cookie(name, value, maxAge) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`; }
function clearCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`; }
function headersWithCookie(setCookie) { return setCookie ? { 'Set-Cookie': setCookie } : {}; }
function cleanName(value) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60); }
function cleanEmail(value) { return String(value || '').trim().toLowerCase().slice(0, 254); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function origin(request, env) { return env.AUTH_BASE_URL || new URL(request.url).origin; }
async function readBody(request) { try { return await request.json(); } catch { return null; } }
function redirect(url, headers = {}) { return new Response(null, { status: 302, headers: { Location: url, ...headers } }); }

async function createSession(env, userId) {
  const raw = randomToken(32);
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').bind(id(), userId, await digest(raw), t + SESSION_TTL, t, t).run();
  return raw;
}
async function getSession(request, env) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const row = await env.DB.prepare('SELECT s.*, u.email, u.display_name, u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(match[1]), now()).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').bind(now(), row.id).run();
  return row;
}

async function signup(request, env) {
  const body = await readBody(request);
  const name = cleanName(body?.name), email = cleanEmail(body?.email), password = String(body?.password || '');
  if (name.length < 2) return json({ error: 'Please enter your name.' }, 400);
  if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400);
  if (await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) return json({ error: 'An account with that email already exists.' }, 409);
  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16))), t = now(), userId = id();
  const passwordHash = await hashPassword(password, salt);
  await env.DB.prepare('INSERT INTO users (id,email,display_name,password_hash,password_salt,password_iterations,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)').bind(userId, email, name, passwordHash, salt, PBKDF2_ITERATIONS, t, t).run();
  const token = await createSession(env, userId);
  return json({ user: { id: userId, email, display_name: name } }, 201, headersWithCookie(cookie(SESSION_COOKIE, token, SESSION_TTL)));
}

async function login(request, env) {
  const body = await readBody(request), email = cleanEmail(body?.email), password = String(body?.password || '');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!user?.password_hash || !user.password_salt) return json({ error: 'Invalid email or password.' }, 401);
  const hash = await hashPassword(password, user.password_salt, user.password_iterations || PBKDF2_ITERATIONS);
  if (hash !== user.password_hash) return json({ error: 'Invalid email or password.' }, 401);
  await env.DB.prepare('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?').bind(now(), now(), user.id).run();
  const token = await createSession(env, user.id);
  return json({ user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url } }, 200, headersWithCookie(cookie(SESSION_COOKIE, token, SESSION_TTL)));
}

async function logout(request, env) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (match) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(match[1])).run();
  return json({ ok: true }, 200, headersWithCookie(clearCookie()));
}
async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false });
  return json({ authenticated: true, user: { id: session.user_id, email: session.email, display_name: session.display_name, avatar_url: session.avatar_url } });
}

function providerCredentials(provider, env) {
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`], clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) throw new Error(`${provider} OAuth is not configured.`);
  return { clientId, clientSecret };
}
async function oauthStart(request, env, provider) {
  const config = PROVIDERS[provider];
  if (!config) return json({ error: 'Unsupported OAuth provider.' }, 404);
  const { clientId } = providerCredentials(provider, env);
  const redirectUri = `${origin(request, env)}/api/auth/oauth/${provider}/callback`, state = randomToken(24), verifier = randomToken(32);
  await env.DB.prepare('INSERT INTO oauth_states (state,provider,redirect_uri,code_verifier,created_at,expires_at) VALUES (?,?,?,?,?,?)').bind(state, provider, redirectUri, verifier, now(), now() + OAUTH_STATE_TTL).run();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: config.scope, state });
  if (provider === 'google') params.set('access_type', 'online');
  if (provider === 'microsoft') params.set('response_mode', 'query');
  return redirect(`${config.authorize}?${params}`);
}

async function oauthCallback(request, env, provider) {
  const config = PROVIDERS[provider];
  if (!config) return new Response('Unsupported OAuth provider.', { status: 404 });
  const url = new URL(request.url), state = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!state || !code) return new Response('OAuth authorization was cancelled or failed.', { status: 400 });
  const stateRow = await env.DB.prepare('SELECT * FROM oauth_states WHERE state=? AND provider=? AND expires_at>?').bind(state, provider, now()).first();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state=?').bind(state).run();
  if (!stateRow) return new Response('OAuth state expired. Please try again.', { status: 400 });
  const { clientId, clientSecret } = providerCredentials(provider, env);
  const tokenBody = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, code, redirect_uri: stateRow.redirect_uri, grant_type: 'authorization_code' });
  const tokenResponse = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: tokenBody });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) return new Response('Could not complete OAuth sign-in.', { status: 502 });
  const profile = await fetchOAuthProfile(provider, token.access_token);
  if (!profile?.id || !profile.email || profile.emailVerified === false) return new Response('Your OAuth account did not provide a verified email address.', { status: 400 });
  const email = cleanEmail(profile.email);
  let identity = await env.DB.prepare('SELECT user_id FROM auth_identities WHERE provider=? AND provider_user_id=?').bind(provider, profile.id).first();
  let user;
  if (identity) {
    user = await env.DB.prepare('SELECT * FROM users WHERE id=?').bind(identity.user_id).first();
  } else {
    user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
    if (!user) {
      user = { id: id(), email, display_name: cleanName(profile.name) || email.split('@')[0], avatar_url: profile.avatarUrl || null };
      const t = now();
      await env.DB.prepare('INSERT INTO users (id,email,display_name,avatar_url,created_at,updated_at) VALUES (?,?,?,?,?,?)').bind(user.id, user.email, user.display_name, user.avatar_url, t, t).run();
    }
    await env.DB.prepare('INSERT INTO auth_identities (id,user_id,provider,provider_user_id,provider_email,created_at) VALUES (?,?,?,?,?,?)').bind(id(), user.id, provider, profile.id, email, now()).run();
  }
  await env.DB.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').bind(now(), now(), user.id).run();
  const sessionToken = await createSession(env, user.id);
  return redirect(`${origin(request, env)}/index.html?auth=success`, headersWithCookie(cookie(SESSION_COOKIE, sessionToken, SESSION_TTL)));
}

async function fetchOAuthProfile(provider, accessToken) {
  if (provider === 'google') {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const p = await response.json();
    return { id: p.sub, email: p.email, name: p.name, avatarUrl: p.picture, emailVerified: p.email_verified !== false };
  }
  if (provider === 'microsoft') {
    const response = await fetch('https://graph.microsoft.com/oidc/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const p = await response.json();
    return { id: p.sub, email: p.email || p.preferred_username, name: p.name, avatarUrl: null, emailVerified: true };
  }
  const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'MELO' } });
  const p = await response.json();
  const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'MELO' } });
  const emails = await emailsResponse.json();
  const primary = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) : null;
  return { id: String(p.id), email: primary?.email, name: p.name || p.login, avatarUrl: p.avatar_url, emailVerified: Boolean(primary?.verified) };
}

async function handle(request, env) {
  if (!env.DB) return json({ error: 'Authentication database is not configured.' }, 503);
  const path = new URL(request.url).pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204 });
  try {
    if (path === '/api/auth/signup' && request.method === 'POST') return await signup(request, env);
    if (path === '/api/auth/login' && request.method === 'POST') return await login(request, env);
    if (path === '/api/auth/logout' && request.method === 'POST') return await logout(request, env);
    if (path === '/api/auth/me' && request.method === 'GET') return await me(request, env);
    const match = path.match(/^\/api\/auth\/oauth\/(google|github|microsoft)(\/callback)?$/);
    if (match && request.method === 'GET') return match[2] ? await oauthCallback(request, env, match[1]) : await oauthStart(request, env, match[1]);
    return json({ error: 'Not found.' }, 404);
  } catch (error) {
    console.error('MELO auth error', error);
    return json({ error: error?.message || 'Authentication service error.' }, 500);
  }
}
export default { fetch: handle };

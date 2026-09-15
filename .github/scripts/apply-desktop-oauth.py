from pathlib import Path
p = Path('melo-auth-worker.js')
s = p.read_text()
if '/api/auth/oauth/exchange' in s:
    print('Desktop OAuth already present.')
    raise SystemExit(0)
s = s.replace("const PBKDF2_ITERATIONS = 100000;", "const PBKDF2_ITERATIONS = 210000;")
start = s.find('async function sendVerificationEmail')
end = s.find('\nasync function signup', start)
if start >= 0 and end > start and 'api.resend.com/emails' not in s[start:end]:
    email = '''async function sendVerificationEmail(env, email, name, code) {
  if (!env.RESEND_API_KEY) throw new Error('Email delivery is not configured.');
  const from = env.RESEND_FROM_EMAIL || 'MELO <onboarding@resend.dev>';
  const safeName = name.replace(/[<>]/g, '');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Your MELO verification code',
      html: `<!doctype html><html><body style="margin:0;background:#f5efe4;color:#171513;font-family:Arial,sans-serif;padding:32px"><div style="max-width:560px;margin:auto;background:#fffaf2;border:1px solid #171513;padding:36px"><div style="font-size:24px;font-weight:800;letter-spacing:.12em">MELO</div><p style="margin-top:28px">Hi ${safeName},</p><p>Use this code to verify your email and finish creating your MELO account:</p><div style="font-size:36px;font-weight:800;letter-spacing:.25em;text-align:center;padding:24px 12px;margin:24px 0;border:2px solid #171513;background:#f0d6df">${code}</div><p style="font-size:14px">This code expires in 10 minutes. If you did not start creating a MELO account, you can ignore this email.</p></div></body></html>`
    })
  });
  if (!response.ok) {
    let details = '';
    try { details = (await response.json())?.message || ''; } catch {}
    console.error('Resend error', response.status, details);
    throw new Error('Could not send the verification email.');
  }
}'''
    s = s[:start] + email + s[end:]
marker = 'async function createSession(env, userId) {'
helpers = '''function validDesktopRedirectUri(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === '/callback' && !url.search && !url.hash;
  } catch { return false; }
}

let desktopOAuthSchemaPromise = null;
async function ensureDesktopOAuthSchema(env) {
  if (!desktopOAuthSchemaPromise) {
    desktopOAuthSchemaPromise = (async () => {
      try {
        await env.DB.prepare('ALTER TABLE oauth_states ADD COLUMN desktop_redirect_uri TEXT').run();
      } catch (error) {
        if (!/duplicate column|already exists/i.test(String(error?.message || error))) throw error;
      }
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS desktop_oauth_codes (
        code_hash TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        consumed_at INTEGER,
        created_at INTEGER NOT NULL
      )`).run();
    })().catch(error => { desktopOAuthSchemaPromise = null; throw error; });
  }
  await desktopOAuthSchemaPromise;
}

'''
s = s.replace(marker, helpers + marker, 1)
a = s.index('async function getSession(request, env) {')
b = s.index('\n}\n\nasync function sendVerificationEmail', a) + 2
s = s[:a] + '''async function getSession(request, env) {
  const header = request.headers.get('Cookie') || '';
  const cookieMatch = header.match(new RegExp(`(?:^|;\\\\s*)${SESSION_COOKIE}=([^;]+)`));
  const bearer = request.headers.get('Authorization') || '';
  const bearerMatch = bearer.match(/^Bearer\\s+(.+)$/i);
  const token = cookieMatch?.[1] || bearerMatch?.[1]?.trim();
  if (!token) return null;
  const row = await env.DB.prepare('SELECT s.*, u.email, u.display_name, u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token), now()).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').bind(now(), row.id).run();
  return row;
}''' + s[b:]
a = s.index('async function oauthStart(request, env, provider) {')
b = s.index('\n}\n\nasync function oauthCallback', a) + 2
s = s[:a] + '''async function oauthStart(request, env, provider) {
  const config = PROVIDERS[provider];
  if (!config) return json({ error: 'Unsupported OAuth provider.' }, 404, {}, request);
  const { clientId } = providerCredentials(provider, env);
  const requestUrl = new URL(request.url);
  const desktopRedirect = requestUrl.searchParams.get('redirect_uri');
  if (desktopRedirect && !validDesktopRedirectUri(desktopRedirect)) return json({ error: 'Invalid desktop redirect URI.' }, 400, {}, request);
  if (desktopRedirect) await ensureDesktopOAuthSchema(env);
  const redirectUri = `${origin(request, env)}/api/auth/oauth/${provider}/callback`;
  const state = randomToken(24), verifier = randomToken(32);
  await env.DB.prepare('INSERT INTO oauth_states (state,provider,redirect_uri,code_verifier,desktop_redirect_uri,created_at,expires_at) VALUES (?,?,?,?,?,?,?)').bind(state, provider, redirectUri, verifier, desktopRedirect || null, now(), now() + OAUTH_STATE_TTL).run();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: config.scope, state });
  if (provider === 'google') params.set('access_type', 'online');
  if (provider === 'microsoft') params.set('response_mode', 'query');
  return redirect(`${config.authorize}?${params}`);
}''' + s[b:]
needle = "  await env.DB.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').bind(now(), now(), user.id).run();\n  const sessionToken = await createSession(env, user.id);\n  return redirect(`${origin(request, env)}/index.html?auth=success`, headersWithCookie(cookie(SESSION_COOKIE, sessionToken, SESSION_TTL)));"
replacement = "  await env.DB.prepare('UPDATE users SET last_login_at=?,updated_at=? WHERE id=?').bind(now(), now(), user.id).run();\n  if (stateRow.desktop_redirect_uri) {\n    await ensureDesktopOAuthSchema(env);\n    const rawCode = randomToken(32);\n    await env.DB.prepare('INSERT INTO desktop_oauth_codes (code_hash,user_id,expires_at,consumed_at,created_at) VALUES (?,?,?,?,?)').bind(await digest(rawCode), user.id, now() + 60, null, now()).run();\n    return redirect(`${stateRow.desktop_redirect_uri}?code=${encodeURIComponent(rawCode)}`);\n  }\n  const sessionToken = await createSession(env, user.id);\n  return redirect(`${origin(request, env)}/index.html?auth=success`, headersWithCookie(cookie(SESSION_COOKIE, sessionToken, SESSION_TTL)));"
if needle not in s: raise SystemExit('callback pattern missing')
s = s.replace(needle, replacement, 1)
marker = 'async function fetchOAuthProfile(provider, accessToken) {'
exchange = '''async function oauthDesktopExchange(request, env) {
  await ensureDesktopOAuthSchema(env);
  const body = await readBody(request);
  const code = String(body?.code || '').trim();
  if (!code || code.length < 20) return json({ error: 'Invalid desktop OAuth code.' }, 400, {}, request);
  const row = await env.DB.prepare('SELECT * FROM desktop_oauth_codes WHERE code_hash=? AND expires_at>? AND consumed_at IS NULL').bind(await digest(code), now()).first();
  if (!row) return json({ error: 'Desktop OAuth code is invalid or expired.' }, 400, {}, request);
  const consumed = await env.DB.prepare('UPDATE desktop_oauth_codes SET consumed_at=? WHERE code_hash=? AND consumed_at IS NULL').bind(now(), row.code_hash).run();
  if (!consumed?.meta?.changes) return json({ error: 'Desktop OAuth code has already been used.' }, 409, {}, request);
  const sessionToken = await createSession(env, row.user_id);
  const user = await env.DB.prepare('SELECT id,email,display_name,avatar_url FROM users WHERE id=?').bind(row.user_id).first();
  return json({ authenticated: true, session_token: sessionToken, user }, 200, {}, request);
}

'''
s = s.replace(marker, exchange + marker, 1)
needle = "    if (path === '/api/auth/me' && request.method === 'GET') return await me(request, env);"
s = s.replace(needle, needle + "\n    if (path === '/api/auth/oauth/exchange' && request.method === 'POST') return await oauthDesktopExchange(request, env);", 1)
p.write_text(s)
print('patched')

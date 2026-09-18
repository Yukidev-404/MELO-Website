const SESSION_COOKIE = 'melo_session';
const SESSION_TTL = 60 * 60 * 24 * 30;
const OAUTH_STATE_TTL = 10 * 60;
const VERIFICATION_TTL = 10 * 60;
const VERIFICATION_MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN = 60;
const PBKDF2_ITERATIONS = 100000;

let passwordResetSchemaPromise = null;
const FRONTEND_ORIGIN = 'https://yukidev-404.github.io';
const PROVIDERS = {
  google: { authorize: 'https://accounts.google.com/o/oauth2/v2/auth', token: 'https://oauth2.googleapis.com/token', scope: 'openid email profile' },
  github: { authorize: 'https://github.com/login/oauth/authorize', token: 'https://github.com/login/oauth/access_token', scope: 'read:user user:email' },
  spotify: { authorize: 'https://accounts.spotify.com/authorize', token: 'https://accounts.spotify.com/api/token', scope: 'user-read-email user-read-private' }
};

let pendingSchemaPromise = null;

function corsHeaders(request) {
  const requestOrigin = request.headers.get('Origin');
  const allowOrigin = requestOrigin === FRONTEND_ORIGIN ? requestOrigin : null;
  return allowOrigin ? {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Vary': 'Origin'
  } : {};
}

const json = (body, status = 200, extra = {}, request = null) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...(request ? corsHeaders(request) : {}),
    ...extra
  }
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
async function hmacDigest(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return bytesToBase64(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: base64ToBytes(salt), iterations, hash: 'SHA-256' }, key, 256);
  return bytesToBase64(new Uint8Array(bits));
}
function randomToken(size = 32) { return bytesToBase64(crypto.getRandomValues(new Uint8Array(size))); }
function verificationCode() { return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0'); }
function cookie(name, value, maxAge) { return `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=${maxAge}`; }
function clearCookie() { return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0`; }
function headersWithCookie(setCookie) { return setCookie ? { 'Set-Cookie': setCookie } : {}; }
function cleanName(value) { return String(value || '').trim().replace(/\s+/g, ' ').slice(0, 60); }
function cleanEmail(value) { return String(value || '').trim().toLowerCase().slice(0, 254); }
function validEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
function origin(request, env) { return env.AUTH_BASE_URL || new URL(request.url).origin; }
async function readBody(request) { try { return await request.json(); } catch { return null; } }
function redirect(url, headers = {}) { return new Response(null, { status: 302, headers: { Location: url, ...headers } }); }

async function ensurePendingSchema(env) {
  if (!pendingSchemaPromise) {
    pendingSchemaPromise = (async () => {
      await env.DB.prepare(`
        CREATE TABLE IF NOT EXISTS pending_signups (
          id TEXT PRIMARY KEY,
          email TEXT NOT NULL UNIQUE,
          display_name TEXT NOT NULL,
          handle TEXT NOT NULL DEFAULT '',
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          password_iterations INTEGER NOT NULL,
          code_hash TEXT NOT NULL,
          expires_at INTEGER NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          last_sent_at INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        )
      `).run();
      try { await env.DB.prepare("ALTER TABLE pending_signups ADD COLUMN handle TEXT NOT NULL DEFAULT ''").run(); }
      catch (error) { if (!/duplicate column|already exists/i.test(String(error?.message || error))) throw error; }
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS melo_profiles (
        user_id TEXT PRIMARY KEY,
        handle TEXT,
        bio TEXT NOT NULL DEFAULT '',
        pronouns TEXT NOT NULL DEFAULT '',
        country TEXT NOT NULL DEFAULT '',
        avatar_data TEXT,
        public_card INTEGER NOT NULL DEFAULT 1,
        show_recent INTEGER NOT NULL DEFAULT 1,
        show_artists INTEGER NOT NULL DEFAULT 1,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )`).run();
      await env.DB.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_melo_profiles_handle ON melo_profiles(handle) WHERE handle IS NOT NULL AND handle <> ''").run();
    })().catch(error => {
      pendingSchemaPromise = null;
      throw error;
    });
  }
  await pendingSchemaPromise;
}

function validDesktopRedirectUri(value) {
  try {
    const url = new URL(String(value || ''));
    return url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port && url.pathname === '/callback' && !url.search && !url.hash;
  } catch { return false; }
}

let desktopOAuthSchemaPromise = null;
async function ensureDesktopOAuthSchema(env) {
  if (!desktopOAuthSchemaPromise) {
    desktopOAuthSchemaPromise = (async () => {
      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (
        state TEXT PRIMARY KEY,
        provider TEXT NOT NULL,
        redirect_uri TEXT NOT NULL,
        code_verifier TEXT,
        desktop_redirect_uri TEXT,
        connect_user_id TEXT,
        created_at INTEGER NOT NULL,
        expires_at INTEGER NOT NULL
      )`).run();
      try {
        await env.DB.prepare('ALTER TABLE oauth_states ADD COLUMN desktop_redirect_uri TEXT').run();
      } catch (error) {
        if (!/duplicate column|already exists/i.test(String(error?.message || error))) throw error;
      }
      try {
        await env.DB.prepare('ALTER TABLE oauth_states ADD COLUMN connect_user_id TEXT').run();
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

async function createSession(env, userId) {
  const raw = randomToken(32);
  const t = now();
  await env.DB.prepare('INSERT INTO sessions (id,user_id,token_hash,expires_at,created_at,last_seen_at) VALUES (?,?,?,?,?,?)').bind(id(), userId, await digest(raw), t + SESSION_TTL, t, t).run();
  return raw;
}
async function getSession(request, env) {
  const header = request.headers.get('Cookie') || '';
  const cookieMatch = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  const bearer = request.headers.get('Authorization') || '';
  const bearerMatch = bearer.match(/^Bearer\s+(.+)$/i);
  const token = cookieMatch?.[1] || bearerMatch?.[1]?.trim();
  if (!token) return null;
  const row = await env.DB.prepare('SELECT s.*, u.email, u.display_name, u.avatar_url FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token), now()).first();
  if (!row) return null;
  await env.DB.prepare('UPDATE sessions SET last_seen_at=? WHERE id=?').bind(now(), row.id).run();
  return row;
}

async function sendVerificationEmail(env, email, name, code) {
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
}

async function ensurePasswordResetSchema(env) {
  if (!passwordResetSchemaPromise) {
    passwordResetSchemaPromise = env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        email TEXT NOT NULL,
        code_hash TEXT NOT NULL,
        expires_at INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_sent_at INTEGER NOT NULL,
        created_at INTEGER NOT NULL
      )
    `).run().catch(error => {
      passwordResetSchemaPromise = null;
      throw error;
    });
  }
  await passwordResetSchemaPromise;
}

async function sendPasswordResetEmail(env, email, name, code) {
  if (!env.RESEND_API_KEY) throw new Error('Email delivery is not configured.');
  const from = env.RESEND_FROM_EMAIL || 'MELO <onboarding@resend.dev>';
  const safeName = String(name || 'there').replace(/[<>]/g, '');
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.RESEND_API_KEY}` },
    body: JSON.stringify({
      from,
      to: [email],
      subject: 'Reset your MELO password',
      html: `<!doctype html><html><body style="margin:0;background:#f5efe4;color:#171513;font-family:Arial,sans-serif;padding:32px"><div style="max-width:560px;margin:auto;background:#fffaf2;border:1px solid #171513;padding:36px"><div style="font-size:24px;font-weight:800;letter-spacing:.12em">MELO</div><p style="margin-top:28px">Hi ${safeName},</p><p>Use this code to reset your MELO password:</p><div style="font-size:36px;font-weight:800;letter-spacing:.25em;text-align:center;padding:24px 12px;margin:24px 0;border:2px solid #171513;background:#f0d6df">${code}</div><p style="font-size:14px">This code expires in 10 minutes. If you did not request a password reset, you can ignore this email.</p></div></body></html>`
    })
  });
  if (!response.ok) {
    let details = '';
    try { details = (await response.json())?.message || ''; } catch {}
    console.error('Resend password reset error', response.status, details);
    throw new Error('Could not send the password reset email.');
  }
}

async function checkHandle(request, env) {
  const url = new URL(request.url);
  const handle = cleanHandle(url.searchParams.get('handle'));
  if (!validHandle(handle)) return json({ available: false, valid: false, error: 'Use 3–30 letters, numbers, _ or -.' }, 200, {}, request);
  await ensurePendingSchema(env);
  const takenProfile = await env.DB.prepare('SELECT user_id FROM melo_profiles WHERE lower(handle)=lower(?) LIMIT 1').bind(handle).first().catch(() => null);
  const takenPending = await env.DB.prepare('SELECT id FROM pending_signups WHERE lower(handle)=lower(?) LIMIT 1').bind(handle).first();
  return json({ available: !takenProfile && !takenPending, valid: true, handle }, 200, {}, request);
}

async function requestPasswordReset(request, env) {
  await ensurePasswordResetSchema(env);
  const body = await readBody(request);
  const email = cleanEmail(body?.email);
  if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400, {}, request);

  const generic = { ok: true, message: 'If an account exists for that email, a password reset code has been sent.' };
  const user = await env.DB.prepare('SELECT id,email,display_name FROM users WHERE email=?').bind(email).first();
  if (!user) return json(generic, 200, {}, request);

  const existing = await env.DB.prepare('SELECT id,last_sent_at FROM password_reset_tokens WHERE user_id=?').bind(user.id).first();
  const t = now();
  if (existing && t - Number(existing.last_sent_at || 0) < RESEND_COOLDOWN) return json(generic, 200, {}, request);

  const code = verificationCode();
  const codeHash = await hmacDigest(`reset:${email}:${code}`, env.RESEND_API_KEY || 'MELO-password-reset');

  // Replace the previous reset token before inserting the new one.
  // The old implementation inserted the new token first and then deleted
  // every token except the old row, which immediately deleted the new code.
  if (existing) {
    await env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').bind(user.id).run();
  }

  await env.DB.prepare(`
    INSERT INTO password_reset_tokens (id,user_id,email,code_hash,expires_at,attempts,last_sent_at,created_at)
    VALUES (?,?,?,?,?,?,?,?)
  `).bind(id(), user.id, email, codeHash, t + VERIFICATION_TTL, 0, t, t).run();

  try {
    await sendPasswordResetEmail(env, email, user.display_name, code);
  } catch (error) {
    await env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').bind(user.id).run();
    return json({ error: error?.message || 'Could not send the password reset email.' }, 502, {}, request);
  }
  return json(generic, 200, {}, request);
}

async function resetPassword(request, env) {
  await ensurePasswordResetSchema(env);
  const body = await readBody(request);
  const email = cleanEmail(body?.email);
  const code = String(body?.code || '').trim();
  const password = String(body?.password || '');
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit reset code.' }, 400, {}, request);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400, {}, request);

  const row = await env.DB.prepare('SELECT * FROM password_reset_tokens WHERE email=? AND expires_at>? ORDER BY created_at DESC LIMIT 1').bind(email, now()).first();
  if (!row) return json({ error: 'That reset code is invalid or expired. Please request a new one.' }, 400, {}, request);
  if (Number(row.attempts || 0) >= VERIFICATION_MAX_ATTEMPTS) return json({ error: 'Too many incorrect attempts. Please request a new code.' }, 429, {}, request);

  const expected = await hmacDigest(`reset:${email}:${code}`, env.RESEND_API_KEY || 'MELO-password-reset');
  if (expected !== row.code_hash) {
    await env.DB.prepare('UPDATE password_reset_tokens SET attempts=attempts+1 WHERE id=?').bind(row.id).run();
    return json({ error: 'Incorrect reset code. Please try again.' }, 400, {}, request);
  }

  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const passwordHash = await hashPassword(password, salt);
  const t = now();
  await env.DB.prepare('UPDATE users SET password_hash=?,password_salt=?,password_iterations=?,updated_at=? WHERE id=?')
    .bind(passwordHash, salt, PBKDF2_ITERATIONS, t, row.user_id).run();
  await env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').bind(row.user_id).run();
  await env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(row.user_id).run();
  return json({ ok: true, message: 'Password reset successfully.' }, 200, {}, request);
}

async function signup(request, env) {
  await ensurePendingSchema(env);
  const body = await readBody(request);
  const name = cleanName(body?.name), handle = cleanHandle(body?.handle), email = cleanEmail(body?.email), password = String(body?.password || '');
  if (name.length < 2) return json({ error: 'Please enter your name.' }, 400, {}, request);
  if (!validHandle(handle)) return json({ error: 'Choose a MELO handle with 3–30 letters, numbers, _ or -.' }, 400, {}, request);
  if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400, {}, request);
  if (password.length < 8) return json({ error: 'Password must be at least 8 characters.' }, 400, {}, request);
  if (await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) return json({ error: 'An account with that email already exists.' }, 409, {}, request);
  const handleTaken = await env.DB.prepare('SELECT user_id FROM melo_profiles WHERE lower(handle)=lower(?)').bind(handle).first().catch(() => null);
  if (handleTaken) return json({ error: 'That MELO handle is already taken.' }, 409, {}, request);

  const salt = bytesToBase64(crypto.getRandomValues(new Uint8Array(16)));
  const t = now();
  const passwordHash = await hashPassword(password, salt);
  const code = verificationCode();
  const codeHash = await hmacDigest(`${email}:${code}`, env.RESEND_API_KEY || 'MELO-verification');
  const existing = await env.DB.prepare('SELECT id,last_sent_at FROM pending_signups WHERE email=?').bind(email).first();
  if (existing && t - existing.last_sent_at < RESEND_COOLDOWN) return json({ error: 'A verification code was just sent. Please wait a moment before requesting another.' }, 429, {}, request);

  await env.DB.prepare(`
    INSERT INTO pending_signups (id,email,display_name,handle,password_hash,password_salt,password_iterations,code_hash,expires_at,attempts,last_sent_at,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(email) DO UPDATE SET display_name=excluded.display_name,handle=excluded.handle,password_hash=excluded.password_hash,password_salt=excluded.password_salt,password_iterations=excluded.password_iterations,code_hash=excluded.code_hash,expires_at=excluded.expires_at,attempts=0,last_sent_at=excluded.last_sent_at,updated_at=excluded.updated_at
  `).bind(existing?.id || id(), email, name, handle, passwordHash, salt, PBKDF2_ITERATIONS, codeHash, t + VERIFICATION_TTL, 0, t, existing ? existing.last_sent_at : t, t).run();

  try {
    await sendVerificationEmail(env, email, name, code);
  } catch (error) {
    await env.DB.prepare('DELETE FROM pending_signups WHERE email=?').bind(email).run();
    return json({ error: error?.message || 'Could not send the verification email.' }, 502, {}, request);
  }
  return json({ verification_required: true, email }, 200, {}, request);
}

async function verifyEmail(request, env) {
  await ensurePendingSchema(env);
  const body = await readBody(request);
  const email = cleanEmail(body?.email);
  const code = String(body?.code || '').trim();
  if (!validEmail(email) || !/^\d{6}$/.test(code)) return json({ error: 'Enter the 6-digit verification code.' }, 400, {}, request);
  const pending = await env.DB.prepare('SELECT * FROM pending_signups WHERE email=?').bind(email).first();
  if (!pending) return json({ error: 'No pending signup was found. Please start again.' }, 404, {}, request);
  if (pending.expires_at <= now()) return json({ error: 'That verification code has expired. Please request a new one.' }, 410, {}, request);
  if (pending.attempts >= VERIFICATION_MAX_ATTEMPTS) return json({ error: 'Too many incorrect attempts. Please request a new code.' }, 429, {}, request);

  const expected = await hmacDigest(`${email}:${code}`, env.RESEND_API_KEY || 'MELO-verification');
  if (expected !== pending.code_hash) {
    await env.DB.prepare('UPDATE pending_signups SET attempts=attempts+1,updated_at=? WHERE id=?').bind(now(), pending.id).run();
    const remaining = Math.max(0, VERIFICATION_MAX_ATTEMPTS - pending.attempts - 1);
    return json({ error: remaining ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Incorrect code. Please request a new one.' }, 400, {}, request);
  }

  if (await env.DB.prepare('SELECT id FROM users WHERE email=?').bind(email).first()) {
    await env.DB.prepare('DELETE FROM pending_signups WHERE id=?').bind(pending.id).run();
    return json({ error: 'An account with that email already exists.' }, 409, {}, request);
  }

  const userId = id();
  const t = now();
  const handleTaken = await env.DB.prepare('SELECT user_id FROM melo_profiles WHERE lower(handle)=lower(?)').bind(pending.handle).first().catch(() => null);
  if (handleTaken) return json({ error: 'That MELO handle was taken while you were verifying. Please start again with another handle.' }, 409, {}, request);
  await env.DB.prepare('INSERT INTO users (id,email,display_name,password_hash,password_salt,password_iterations,created_at,updated_at,last_login_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(userId, pending.email, pending.display_name, pending.password_hash, pending.password_salt, pending.password_iterations, t, t, t).run();
  await env.DB.prepare('INSERT INTO melo_profiles (user_id,handle,bio,pronouns,country,avatar_data,public_card,show_recent,show_artists,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(userId, pending.handle, '', '', '', null, 1, 1, 1, t, t).run();
  await env.DB.prepare('DELETE FROM pending_signups WHERE id=?').bind(pending.id).run();
  const token = await createSession(env, userId);
  return json({ user: { id: userId, email: pending.email, display_name: pending.display_name } }, 201, headersWithCookie(cookie(SESSION_COOKIE, token, SESSION_TTL)), request);
}

async function resendCode(request, env) {
  await ensurePendingSchema(env);
  const body = await readBody(request);
  const email = cleanEmail(body?.email);
  if (!validEmail(email)) return json({ error: 'Please enter a valid email address.' }, 400, {}, request);
  const pending = await env.DB.prepare('SELECT * FROM pending_signups WHERE email=?').bind(email).first();
  if (!pending) return json({ error: 'No pending signup was found. Please start again.' }, 404, {}, request);
  const t = now();
  if (t - pending.last_sent_at < RESEND_COOLDOWN) return json({ error: `Please wait ${RESEND_COOLDOWN - (t - pending.last_sent_at)} seconds before requesting another code.` }, 429, {}, request);
  const code = verificationCode();
  const codeHash = await hmacDigest(`${email}:${code}`, env.RESEND_API_KEY || 'MELO-verification');
  await env.DB.prepare('UPDATE pending_signups SET code_hash=?,expires_at=?,attempts=0,last_sent_at=?,updated_at=? WHERE id=?').bind(codeHash, t + VERIFICATION_TTL, t, t, pending.id).run();
  try {
    await sendVerificationEmail(env, email, pending.display_name, code);
  } catch (error) {
    return json({ error: error?.message || 'Could not send the verification email.' }, 502, {}, request);
  }
  return json({ ok: true }, 200, {}, request);
}

async function login(request, env) {
  const body = await readBody(request), email = cleanEmail(body?.email), password = String(body?.password || '');
  const user = await env.DB.prepare('SELECT * FROM users WHERE email=?').bind(email).first();
  if (!user?.password_hash || !user.password_salt) return json({ error: 'Invalid email or password.' }, 401, {}, request);
  const hash = await hashPassword(password, user.password_salt, user.password_iterations || PBKDF2_ITERATIONS);
  if (hash !== user.password_hash) return json({ error: 'Invalid email or password.' }, 401, {}, request);
  await env.DB.prepare('UPDATE users SET last_login_at=?, updated_at=? WHERE id=?').bind(now(), now(), user.id).run();
  const token = await createSession(env, user.id);
  return json({ user: { id: user.id, email: user.email, display_name: user.display_name, avatar_url: user.avatar_url } }, 200, headersWithCookie(cookie(SESSION_COOKIE, token, SESSION_TTL)), request);
}

async function deleteAccount(request, env) {
  const body = await request.json().catch(() => ({}));
  if (body.confirmation !== 'DELETE') return json({ error: 'Type DELETE to confirm account deletion.' }, 400, {}, request);
  const session = await getSession(request, env);
  if (!session) return json({ error: 'Please sign in to delete your account.' }, 401, {}, request);
  const userId = session.user_id;
  const user = await env.DB.prepare('SELECT id,email FROM users WHERE id=?').bind(userId).first();
  if (!user) return json({ error: 'Account not found.' }, 404, {}, request);
  const statements = [
    env.DB.prepare('DELETE FROM melo_listening_events WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM melo_favorites WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM melo_profiles WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM auth_identities WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM password_reset_tokens WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM desktop_oauth_codes WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM sessions WHERE user_id=?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id=?').bind(userId)
  ];
  await env.DB.batch(statements);
  return json({ ok: true, deleted: true }, 200, headersWithCookie(clearCookie()), request);
}

async function logout(request, env) {
  const header = request.headers.get('Cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (match) await env.DB.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await digest(match[1])).run();
  return json({ ok: true }, 200, headersWithCookie(clearCookie()), request);
}
async function me(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false }, 200, {}, request);
  return json({ authenticated: true, user: { id: session.user_id, email: session.email, display_name: session.display_name, avatar_url: session.avatar_url } }, 200, {}, request);
}

function providerCredentials(provider, env) {
  const prefix = provider.toUpperCase();
  const clientId = env[`${prefix}_CLIENT_ID`], clientSecret = env[`${prefix}_CLIENT_SECRET`];
  if (!clientId) throw new Error(`${provider} OAuth is not configured.`);
  if (provider === 'spotify') return { clientId, clientSecret: null };
  if (!clientSecret) throw new Error(`${provider} OAuth is not configured.`);
  return { clientId, clientSecret };
}
async function pkceChallenge(verifier) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return bytesToBase64(new Uint8Array(digest));
}
async function oauthStart(request, env, provider) {
  const config = PROVIDERS[provider];
  if (!config) return json({ error: 'Unsupported OAuth provider.' }, 404, {}, request);
  const { clientId } = providerCredentials(provider, env);
  const requestUrl = new URL(request.url);
  const desktopRedirect = requestUrl.searchParams.get('redirect_uri');
  if (desktopRedirect && !validDesktopRedirectUri(desktopRedirect)) return json({ error: 'Invalid desktop redirect URI.' }, 400, {}, request);
  await ensureDesktopOAuthSchema(env);
  const redirectUri = `${origin(request, env)}/api/auth/oauth/${provider}/callback`;
  const state = randomToken(24), verifier = randomToken(32);
  const connectUser = new URL(request.url).searchParams.get('mode') === 'connect' ? await getSession(request, env) : null;
  if (new URL(request.url).searchParams.get('mode') === 'connect' && !connectUser) return redirect(`${origin(request, env)}/login.html?error=signin-required`);
  await env.DB.prepare('INSERT INTO oauth_states (state,provider,redirect_uri,code_verifier,desktop_redirect_uri,connect_user_id,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)').bind(state, provider, redirectUri, verifier, desktopRedirect || null, connectUser?.user_id || null, now(), now() + OAUTH_STATE_TTL).run();
  const params = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: config.scope, state });
  if (provider === 'spotify') { params.set('code_challenge_method', 'S256'); params.set('code_challenge', await pkceChallenge(verifier)); }
  if (provider === 'google') params.set('access_type', 'online');
  if (provider === 'spotify') { params.set('show_dialog', 'true'); params.set('code_challenge_method', 'S256'); params.set('code_challenge', await pkceChallenge(verifier)); }
  return redirect(`${config.authorize}?${params}`);
}

async function oauthCallback(request, env, provider) {
  const config = PROVIDERS[provider];
  if (!config) return new Response('Unsupported OAuth provider.', { status: 404 });
  // The OAuth callback can be the first request handled by a fresh Worker isolate.
  // Always initialize the desktop OAuth schema before touching oauth_states.
  await ensureDesktopOAuthSchema(env);
  const url = new URL(request.url), state = url.searchParams.get('state'), code = url.searchParams.get('code');
  if (!state || !code) return new Response('OAuth authorization was cancelled or failed.', { status: 400 });
  const stateRow = await env.DB.prepare('SELECT * FROM oauth_states WHERE state=? AND provider=? AND expires_at>?').bind(state, provider, now()).first();
  await env.DB.prepare('DELETE FROM oauth_states WHERE state=?').bind(state).run();
  if (!stateRow) return new Response('OAuth state expired. Please try again.', { status: 400 });
  const { clientId, clientSecret } = providerCredentials(provider, env);
  const tokenBody = new URLSearchParams({ client_id: clientId, code, redirect_uri: stateRow.redirect_uri, grant_type: 'authorization_code' });
  if (provider === 'spotify') tokenBody.set('code_verifier', stateRow.code_verifier); else tokenBody.set('client_secret', clientSecret);
  if (provider === 'spotify') tokenBody.set('code_verifier', stateRow.code_verifier); else tokenBody.set('client_secret', clientSecret);
  const tokenResponse = await fetch(config.token, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' }, body: tokenBody });
  const token = await tokenResponse.json();
  if (!tokenResponse.ok || !token.access_token) return new Response('Could not complete OAuth sign-in.', { status: 502 });
  const profile = await fetchOAuthProfile(provider, token.access_token);
  if (!profile?.id || !profile.email || profile.emailVerified === false) return new Response('Your OAuth account did not provide a verified email address.', { status: 400 });
  const email = cleanEmail(profile.email);
  if (stateRow.connect_user_id) {
    const current = await getSession(request, env);
    if (!current || current.user_id !== stateRow.connect_user_id) return new Response('Your MELO session expired. Please try again.', { status: 401 });
    const existing = await env.DB.prepare('SELECT user_id FROM auth_identities WHERE provider=? AND provider_user_id=?').bind(provider, profile.id).first();
    if (existing && existing.user_id !== current.user_id) return new Response('That account is already connected to another MELO account.', { status: 409 });
    if (!existing) await env.DB.prepare('INSERT INTO auth_identities (id,user_id,provider,provider_user_id,provider_email,created_at) VALUES (?,?,?,?,?,?)').bind(id(), current.user_id, provider, profile.id, email, now()).run();
    return redirect(`${origin(request, env)}/account-settings.html?connected=${encodeURIComponent(provider)}`);
  }

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
  await env.DB.prepare('UPDATE users SET display_name=COALESCE(NULLIF(?,\'\'),display_name), avatar_url=COALESCE(NULLIF(?,\'\'),avatar_url), last_login_at=?,updated_at=? WHERE id=?').bind(cleanName(profile.name), profile.avatarUrl || '', now(), now(), user.id).run();
  if (stateRow.desktop_redirect_uri) {
    await ensureDesktopOAuthSchema(env);
    const rawCode = randomToken(32);
    await env.DB.prepare('INSERT INTO desktop_oauth_codes (code_hash,user_id,expires_at,consumed_at,created_at) VALUES (?,?,?,?,?)').bind(await digest(rawCode), user.id, now() + 60, null, now()).run();
    return redirect(`${stateRow.desktop_redirect_uri}?code=${encodeURIComponent(rawCode)}`);
  }
  const sessionToken = await createSession(env, user.id);
  return redirect(`${origin(request, env)}/index.html?auth=success`, headersWithCookie(cookie(SESSION_COOKIE, sessionToken, SESSION_TTL)));
}

async function oauthDesktopExchange(request, env) {
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

async function fetchOAuthProfile(provider, accessToken) {
  if (provider === 'google') {
    const response = await fetch('https://openidconnect.googleapis.com/v1/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } });
    const p = await response.json();
    return { id: p.sub, email: p.email, name: p.name, avatarUrl: p.picture, emailVerified: p.email_verified !== false };
  }
  if (provider === 'spotify') {
    const response = await fetch('https://api.spotify.com/v1/me', { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) return null;
    const p = await response.json();
    return { id: p.id, email: p.email, name: p.display_name || p.id, avatarUrl: p.images?.[0]?.url || null, emailVerified: true };
  }
  const response = await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'MELO' } });
  const p = await response.json();
  const emailsResponse = await fetch('https://api.github.com/user/emails', { headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github+json', 'User-Agent': 'MELO' } });
  const emails = await emailsResponse.json();
  const primary = Array.isArray(emails) ? emails.find(e => e.primary && e.verified) : null;
  return { id: String(p.id), email: primary?.email, name: p.name || p.login, avatarUrl: p.avatar_url, emailVerified: Boolean(primary?.verified) };
}


let meloStatsSchemaPromise = null;
async function ensureMeloStatsSchema(env) {
  if (!meloStatsSchemaPromise) meloStatsSchemaPromise=(async()=>{
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS melo_listening_events (id TEXT PRIMARY KEY,user_id TEXT NOT NULL,event_type TEXT NOT NULL,source TEXT NOT NULL,track_id TEXT,track_key TEXT NOT NULL,title TEXT,artist TEXT,album TEXT,listened_seconds INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL)`).run();
    await env.DB.prepare(`CREATE INDEX IF NOT EXISTS idx_melo_events_user_time ON melo_listening_events(user_id,created_at)`).run();
    await env.DB.prepare(`CREATE TABLE IF NOT EXISTS melo_favorites (user_id TEXT NOT NULL,track_key TEXT NOT NULL,title TEXT,artist TEXT,album TEXT,source TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,track_key))`).run();
  })().catch(e=>{meloStatsSchemaPromise=null;throw e});
  await meloStatsSchemaPromise;
}
function meloStatsValue(v,f=''){return String(v??f).trim().slice(0,300)}
async function meloStatsEvent(request,env){
  const session=await getSession(request,env); if(!session)return json({error:'Please sign in to MELO first.'},401,{},request);
  await ensureMeloStatsSchema(env); const b=await readBody(request); const type=meloStatsValue(b?.event_type).toLowerCase();
  if(!['play','listen','favorite','unfavorite'].includes(type))return json({error:'Unsupported stats event.'},400,{},request);
  const source=meloStatsValue(b?.source,'LOCAL').toUpperCase().slice(0,20); const key=meloStatsValue(b?.track_key||b?.track_id||`${source}:${b?.title||''}:${b?.artist||''}`).slice(0,500); if(!key)return json({error:'Track identity required.'},400,{},request);
  const title=meloStatsValue(b?.title,'Unknown Track'),artist=meloStatsValue(b?.artist,'Unknown Artist'),album=meloStatsValue(b?.album,'Unknown Album'),trackId=meloStatsValue(b?.track_id),t=now();
  if(type==='favorite'||type==='unfavorite'){
    if(type==='favorite') await env.DB.prepare(`INSERT INTO melo_favorites(user_id,track_key,title,artist,album,source,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,track_key) DO UPDATE SET title=excluded.title,artist=excluded.artist,album=excluded.album,source=excluded.source,updated_at=excluded.updated_at`).bind(session.user_id,key,title,artist,album,source,t).run();
    else await env.DB.prepare('DELETE FROM melo_favorites WHERE user_id=? AND track_key=?').bind(session.user_id,key).run();
    return json({ok:true},200,{},request);
  }
  const listened=type==='listen'?Math.max(0,Math.min(86400,Number(b?.listened_seconds||0)||0)):0;
  await env.DB.prepare('INSERT INTO melo_listening_events(id,user_id,event_type,source,track_id,track_key,title,artist,album,listened_seconds,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(id(),session.user_id,type,source,trackId,key,title,artist,album,Math.floor(listened),t).run();
  return json({ok:true},200,{},request);
}
async function meloStatsGet(request,env){
  const session=await getSession(request,env); if(!session)return json({error:'Please sign in to view your Player Card.'},401,{},request); await ensureMeloStatsSchema(env); const u=session.user_id;
  const q=async(sql,...args)=>env.DB.prepare(sql).bind(...args).first();
  const plays=await q("SELECT COUNT(*) n FROM melo_listening_events WHERE user_id=? AND event_type='play'",u); const secs=await q("SELECT COALESCE(SUM(listened_seconds),0) seconds FROM melo_listening_events WHERE user_id=? AND event_type='listen'",u); const uniq=await q("SELECT COUNT(DISTINCT track_key) n FROM melo_listening_events WHERE user_id=? AND event_type='play'",u); const fav=await q('SELECT COUNT(*) n FROM melo_favorites WHERE user_id=?',u);
  const days=(await env.DB.prepare("SELECT DISTINCT date(created_at,'unixepoch','localtime') day FROM melo_listening_events WHERE user_id=? AND event_type IN ('play','listen') ORDER BY day DESC").bind(u).all()).results||[]; const active=new Set(days.map(x=>x.day).filter(Boolean)); let streak=0,d=new Date(); d.setHours(0,0,0,0); while(active.has(d.toLocaleDateString('en-CA'))){streak++;d.setDate(d.getDate()-1)}
  const ar=await q("SELECT artist,COUNT(*) n FROM melo_listening_events WHERE user_id=? AND event_type='play' GROUP BY artist ORDER BY n DESC LIMIT 1",u); const tr=await q("SELECT title,artist,COUNT(*) n FROM melo_listening_events WHERE user_id=? AND event_type='play' GROUP BY track_key,title,artist ORDER BY n DESC LIMIT 1",u); const seconds=Number(secs?.seconds||0),xp=Number(plays?.n||0)*10+Math.floor(seconds/60),level=Math.max(1,Math.floor(xp/500)+1),progress=(xp-(level-1)*500)/500;
  return json({user:{id:u,email:session.email,display_name:session.display_name,avatar_url:session.avatar_url},stats:{tracks_played:Number(plays?.n||0),total_listening_seconds:seconds,unique_tracks:Number(uniq?.n||0),favorites:Number(fav?.n||0),days_active:active.size,listening_streak:streak,top_artist:ar?{name:ar.artist,plays:Number(ar.n)}:null,top_track:tr?{name:tr.title,artist:tr.artist,plays:Number(tr.n)}:null,xp,level,level_progress:Math.max(0,Math.min(1,progress))}},200,{},request);
}

async function handle(request, env) {
  if (!env.DB) return json({ error: 'Authentication database is not configured.' }, 503, {}, request);
  const path = new URL(request.url).pathname;
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request) });
  if (path === '/api/stats/event' && request.method === 'POST') return await meloStatsEvent(request, env);
  if (path === '/api/stats' && request.method === 'GET') return await meloStatsGet(request, env);
  try {
async function connections(request, env) {
  const session = await getSession(request, env);
  if (!session) return json({ authenticated: false }, 401, {}, request);
  const rows = await env.DB.prepare('SELECT provider,provider_email,created_at FROM auth_identities WHERE user_id=? ORDER BY created_at ASC').bind(session.user_id).all();
  return json({ authenticated: true, connections: rows.results || [] }, 200, {}, request);
}

    if (path === '/api/auth/connections' && request.method === 'GET') return await connections(request, env);
    if (path === '/api/auth/check-handle' && request.method === 'GET') return await checkHandle(request, env);
    if (path === '/api/auth/forgot-password' && request.method === 'POST') return await requestPasswordReset(request, env);
    if (path === '/api/auth/reset-password' && request.method === 'POST') return await resetPassword(request, env);
    if (path === '/api/auth/signup' && request.method === 'POST') return await signup(request, env);
    if (path === '/api/auth/verify-email' && request.method === 'POST') return await verifyEmail(request, env);
    if (path === '/api/auth/resend-code' && request.method === 'POST') return await resendCode(request, env);
    if (path === '/api/auth/login' && request.method === 'POST') return await login(request, env);
    if (path === '/api/auth/delete-account' && request.method === 'POST') return await deleteAccount(request, env);
    if (path === '/api/auth/logout' && request.method === 'POST') return await logout(request, env);
    if (path === '/api/auth/me' && request.method === 'GET') return await me(request, env);
    if (path === '/api/auth/oauth/exchange' && request.method === 'POST') return await oauthDesktopExchange(request, env);
    const match = path.match(/^\/api\/auth\/oauth\/(google|github|spotify)(\/callback)?$/);
    if (match && request.method === 'GET') return match[2] ? await oauthCallback(request, env, match[1]) : await oauthStart(request, env, match[1]);
    return json({ error: 'Not found.' }, 404, {}, request);
  } catch (error) {
    console.error('MELO auth error', error);
    return json({ error: error?.message || 'Authentication service error.' }, 500, {}, request);
  }
}
export default { fetch: handle };
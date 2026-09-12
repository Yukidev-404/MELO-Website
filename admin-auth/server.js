import express from 'express';
import session from 'express-session';
import { RedisStore } from 'connect-redis';
import { createClient } from 'redis';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import argon2 from 'argon2';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const required = ['SESSION_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD_HASH', 'REDIS_URL'];
for (const name of required) {
  if (!process.env[name]) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
}

if (process.env.ADMIN_PASSWORD_HASH.includes('REPLACE_ME')) {
  console.error('ADMIN_PASSWORD_HASH is still a placeholder. Generate an Argon2id hash first.');
  process.exit(1);
}

const redisClient = createClient({ url: process.env.REDIS_URL });
redisClient.on('error', (error) => console.error('Redis error:', error));
await redisClient.connect();

app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https://fontlibrary.org'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  referrerPolicy: { policy: 'no-referrer' }
}));
app.use(express.json({ limit: '10kb' }));

app.use(session({
  name: 'melo_admin_session',
  store: new RedisStore({ client: redisClient, prefix: 'melo:admin:' }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    maxAge: 1000 * 60 * 60 * 8
  }
}));

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many sign-in attempts. Try again later.' }
});

function sameOrigin(req) {
  const origin = req.get('origin');
  if (!origin) return true;
  const allowed = process.env.ADMIN_ALLOWED_ORIGIN;
  return Boolean(allowed && origin === allowed);
}

function requireAdmin(req, res, next) {
  if (req.session.admin?.role !== 'admin') {
    return res.status(401).json({ error: 'Unauthorized.' });
  }
  next();
}

app.post('/api/admin/login', loginLimiter, async (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';

  if (!email || !password || email.length > 254 || password.length > 1024) {
    return res.status(400).json({ error: 'Invalid credentials.' });
  }

  // Do not reveal whether the email exists. Password verification is only
  // performed for the configured admin account.
  const validEmail = email === process.env.ADMIN_EMAIL.trim().toLowerCase();
  let validPassword = false;
  if (validEmail) {
    try {
      validPassword = await argon2.verify(process.env.ADMIN_PASSWORD_HASH, password);
    } catch {
      validPassword = false;
    }
  }

  if (!validEmail || !validPassword) {
    return res.status(401).json({ error: 'Invalid credentials.' });
  }

  // Rotate the session ID after authentication to prevent session fixation.
  await new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
  req.session.admin = { role: 'admin', authenticatedAt: Date.now() };

  return res.json({ ok: true, redirect: '/admin/' });
});

app.get('/api/admin/session', requireAdmin, (req, res) => {
  res.json({ authenticated: true, role: 'admin' });
});

app.post('/api/admin/logout', (req, res) => {
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Invalid request origin.' });
  req.session.destroy(() => {
    res.clearCookie('melo_admin_session', { httpOnly: true, secure: isProduction, sameSite: 'strict' });
    res.status(204).end();
  });
});

app.get('/api/admin/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`MELO admin auth listening on port ${PORT}`);
});

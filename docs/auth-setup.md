# MELO account authentication setup

MELO account authentication is split into a dedicated Cloudflare Worker and D1 database. The Worker exposes `/api/auth/*` and the website keeps using the same endpoints from `login.js` and `signup.js`.

Cloudflare Workers can access D1 through a binding such as `env.DB`; D1 databases can be created and configured with Wrangler or from the Cloudflare dashboard.

## 1. Create the D1 database

From the directory containing `melo-auth-worker.js`:

```bash
npx wrangler d1 create melo-auth
```

Bind the returned database to the auth Worker as `DB`.

## 2. Apply the schema

```bash
npx wrangler d1 execute melo-auth --remote --file=melo-auth-schema.sql
```

## 3. Deploy the auth Worker

Create a small Wrangler configuration for the auth Worker, for example:

```toml
name = "melo-auth"
main = "melo-auth-worker.js"
compatibility_date = "2026-09-15"

[[d1_databases]]
binding = "DB"
database_name = "melo-auth"
database_id = "REPLACE_WITH_YOUR_D1_DATABASE_ID"
```

Then deploy:

```bash
npx wrangler deploy
```

## 4. Configure OAuth secrets

Create OAuth applications with Google, GitHub, and Microsoft. The callback URLs must be:

```text
https://YOUR_AUTH_DOMAIN/api/auth/oauth/google/callback
https://YOUR_AUTH_DOMAIN/api/auth/oauth/github/callback
https://YOUR_AUTH_DOMAIN/api/auth/oauth/microsoft/callback
```

Store the credentials as Worker secrets. Never put client secrets in the website JavaScript.

```bash
npx wrangler secret put GOOGLE_CLIENT_ID
npx wrangler secret put GOOGLE_CLIENT_SECRET
npx wrangler secret put GITHUB_CLIENT_ID
npx wrangler secret put GITHUB_CLIENT_SECRET
npx wrangler secret put MICROSOFT_CLIENT_ID
npx wrangler secret put MICROSOFT_CLIENT_SECRET
```

If the public site and auth Worker use different origins, also set `AUTH_BASE_URL` to the public MELO site origin used for the callback redirects.

## 5. Route `/api/auth/*`

The existing MELO site already uses Cloudflare infrastructure. Route `/api/auth/*` to the new `melo-auth` Worker. A Cloudflare Worker service binding is also suitable if the existing front Worker should proxy authentication internally.

The important part is that browser requests such as:

```text
POST /api/auth/login
POST /api/auth/signup
GET  /api/auth/me
GET  /api/auth/oauth/google
```

reach `melo-auth-worker.js`.

## Security notes

- Passwords are stored as PBKDF2-SHA-256 hashes with a per-user random salt, never plaintext.
- Session tokens are random and only their SHA-256 hashes are stored in D1.
- Sessions use Secure, HttpOnly, SameSite=Lax cookies.
- OAuth uses a short-lived state value to prevent CSRF.
- GitHub sign-in requires a verified primary email; Google and Microsoft use their identity email claims.
- Password reset/email verification is intentionally not advertised as active until MELO has a real email delivery provider configured.
- Keep the existing admin authentication separate from normal MELO accounts.

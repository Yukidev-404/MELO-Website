# MELO Admin Authentication

This is the server-side authentication layer for the private MELO administrator console.

> Important: this is **admin authentication, not OAuth**. OAuth requires an authorization server/provider. MELO's admin account is intentionally separate from the user providers (Spotify, Google, GitHub and Microsoft).

## Security model

- Passwords are stored only as **Argon2id hashes**.
- The browser receives an opaque server-side session cookie, never an admin password or long-lived admin token.
- Session cookies use `HttpOnly`, `Secure` in production and `SameSite=Strict`.
- Sessions are stored in Redis rather than process memory.
- The session ID is regenerated after successful login to prevent session fixation.
- Login attempts are rate limited.
- The API rejects cross-origin login/logout requests unless the exact configured origin matches.
- Helmet applies security headers and a restrictive Content Security Policy.
- Admin authorization is checked on the server for protected API routes.
- Secrets belong in the deployment environment, never in GitHub frontend files.

## Setup

1. Install Node.js 20+ and Redis.
2. Copy `.env.example` to `.env` in the deployment environment.
3. Generate a password hash locally:

```bash
npm install
npm run hash-password -- "your-admin-password"
```

4. Put the resulting Argon2id string in `ADMIN_PASSWORD_HASH`.
5. Set a long random `SESSION_SECRET`.
6. Set the single authorized `ADMIN_EMAIL`.
7. Set `REDIS_URL` and the exact `ADMIN_ALLOWED_ORIGIN`.
8. Start the service with `npm start`.

Do **not** commit `.env`, real passwords, session secrets, Redis credentials, or Argon2 hashes that you want to keep private.

## API

- `POST /api/admin/login` — verifies the configured admin account and creates a server session.
- `GET /api/admin/session` — verifies the current admin session.
- `POST /api/admin/logout` — destroys the current admin session.
- `GET /api/admin/health` — basic service health check.

## Deployment note

GitHub Pages can host the MELO static frontend, but it cannot execute this Node.js authentication server. Deploy `admin-auth/` to a real HTTPS backend/runtime and connect the frontend to that backend through your chosen domain/reverse proxy.

For the next security phase, add WebAuthn/passkey MFA before giving the admin account access to sensitive operations. If a real OAuth provider is later desired, use Authorization Code + PKCE (S256), exact redirect URI matching, state/nonce validation and server-side provider credentials instead of putting OAuth secrets in the frontend.

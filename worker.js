import legacyWorker from "./legacy-worker.js";

const AUTH_ROUTES = new Set([
  "/api/admin/status",
  "/api/admin/setup/start",
  "/api/admin/setup/verify",
  "/api/admin/login",
  "/api/admin/logout",
  "/api/admin/me",
  "/api/admin/administrators",
  "/api/admin/invite/info",
  "/api/admin/invite/setup/start",
  "/api/admin/invite/setup/verify"
]);
const SESSION_COOKIE = "melo_admin_session";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (AUTH_ROUTES.has(url.pathname) || url.pathname.startsWith("/api/admin/administrators/")) {
      const authWorker = (await import("./admin-auth-worker.js")).default;
      return authWorker.fetch(request, env, ctx);
    }

    if (url.pathname === "/admin/admin-invite.html" || url.pathname === "/admin/admin-invite.js") {
      const authWorker = (await import("./admin-auth-worker.js")).default;
      return authWorker.fetch(request, env, ctx);
    }

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const session = await getIdentitySession(request, env);
      if (!session) return Response.redirect(`${url.origin}/admin-login.html`, 302);
    }

    return legacyWorker.fetch(request, env, ctx);
  }
};

async function getIdentitySession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const hash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(`
    SELECT s.token_hash, s.expires_at, a.admin_id, a.username, a.email, a.role
    FROM admin_identity_sessions s
    JOIN admin_accounts a ON a.admin_id = s.admin_id
    WHERE s.token_hash = ? AND a.enabled = 1
  `).bind(hash).first();
  if (!row) return null;
  if (Number(row.expires_at) <= Math.floor(Date.now() / 1000)) {
    await env.DB.prepare("DELETE FROM admin_identity_sessions WHERE token_hash=?").bind(hash).run();
    return null;
  }
  return row;
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map(b => b.toString(16).padStart(2, "0")).join("");
}

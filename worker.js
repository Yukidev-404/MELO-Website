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

    // Invitation pages are public. Cloudflare's default HTML handling redirects
    // .html files to clean URLs, so serve the backing no-extension asset directly
    // to avoid a clean-url <-> .html redirect loop.
    if (
      url.pathname === "/admin/admin-invite" ||
      url.pathname === "/admin/admin-invite/" ||
      url.pathname === "/admin/admin-invite.html"
    ) {
      const assetUrl = new URL(request.url);
      assetUrl.pathname = "/admin/admin-invite-page";
      const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
      const headers = new Headers(asset.headers);
      headers.set("Content-Type", "text/html; charset=UTF-8");
      headers.set("Cache-Control", "no-store");
      return new Response(asset.body, { status: asset.status, headers });
    }

    if (url.pathname === "/admin/admin-invite.js") {
      return env.ASSETS.fetch(request);
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

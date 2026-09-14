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

    if (url.pathname === "/api/admin/notifications" || url.pathname === "/api/admin/crashes" || url.pathname === "/api/admin/crash/resolve") {
      return handleSharedAdminReports(request, env, url);
    }

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

    if (url.pathname === "/admin/admin-invite.js") return env.ASSETS.fetch(request);

    if (url.pathname === "/admin" || url.pathname.startsWith("/admin/")) {
      const session = await getIdentitySession(request, env);
      if (!session) return Response.redirect(`${url.origin}/admin-login.html`, 302);
    }

    return legacyWorker.fetch(request, env, ctx);
  }
};

async function handleSharedAdminReports(request, env, url) {
  const session = await getIdentitySession(request, env);
  if (!session) return json({ authenticated: false }, 401);
  await ensureCrashStatusSchema(env);

  if (url.pathname === "/api/admin/notifications" && request.method === "GET") {
    // Notification state is intentionally global/shared across all administrators.
    // Viewing a report never clears it. Only an explicit resolution clears it.
    const [bugs, crashes] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM bug_reports WHERE status IN ('new','reviewing')").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM crash_reports WHERE status = 'unresolved'").first()
    ]);
    return json({
      ok: true,
      unread: {
        bugReports: Number(bugs?.count || 0),
        crashes: Number(crashes?.count || 0)
      }
    });
  }

  if (url.pathname === "/api/admin/crashes" && request.method === "GET") {
    const search = (url.searchParams.get("q") || "").trim().slice(0, 128);
    const p = `%${search.replace(/[%_]/g, "\\$&")}%`;
    const result = search
      ? await env.DB.prepare(`SELECT crash_id,event_id,installation_id,error_type,message,stack_trace,severity,app_version,build,platform,os_version,timestamp,status,resolved_at FROM crash_reports WHERE crash_id LIKE ? ESCAPE '\\' OR installation_id LIKE ? ESCAPE '\\' OR error_type LIKE ? ESCAPE '\\' OR message LIKE ? ESCAPE '\\' OR app_version LIKE ? ESCAPE '\\' ORDER BY timestamp DESC LIMIT 200`).bind(p,p,p,p,p).all()
      : await env.DB.prepare("SELECT crash_id,event_id,installation_id,error_type,message,stack_trace,severity,app_version,build,platform,os_version,timestamp,status,resolved_at FROM crash_reports ORDER BY timestamp DESC LIMIT 200").all();
    return json({ ok: true, rows: result?.results || [] });
  }

  if (url.pathname === "/api/admin/crash/resolve" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON payload." }, 400); }
    const id = String(body?.id || "").trim();
    if (!id || id.length > 128) return json({ error: "Invalid crash ID." }, 400);
    const result = await env.DB.prepare("UPDATE crash_reports SET status='resolved', resolved_at=? WHERE crash_id=?").bind(Math.floor(Date.now()/1000), id).run();
    if (!result?.meta?.changes) return json({ error: "Crash report not found." }, 404);
    return json({ ok: true, crash_id: id, status: "resolved" });
  }

  return json({ error: "Method not allowed." }, 405);
}

async function ensureCrashStatusSchema(env) {
  try { await env.DB.prepare("ALTER TABLE crash_reports ADD COLUMN status TEXT NOT NULL DEFAULT 'unresolved'").run(); }
  catch (error) { const message = String(error?.message || "").toLowerCase(); if (!message.includes("duplicate column") && !message.includes("already exists")) throw error; }
  try { await env.DB.prepare("ALTER TABLE crash_reports ADD COLUMN resolved_at INTEGER").run(); }
  catch (error) { const message = String(error?.message || "").toLowerCase(); if (!message.includes("duplicate column") && !message.includes("already exists")) throw error; }
}

async function getIdentitySession(request, env) {
  const cookie = request.headers.get("Cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`));
  if (!match) return null;
  const hash = await sha256Hex(match[1]);
  const row = await env.DB.prepare(`SELECT s.token_hash,s.expires_at,a.admin_id,a.username,a.email,a.role FROM admin_identity_sessions s JOIN admin_accounts a ON a.admin_id=s.admin_id WHERE s.token_hash=? AND a.enabled=1`).bind(hash).first();
  if (!row) return null;
  if (Number(row.expires_at) <= Math.floor(Date.now()/1000)) { await env.DB.prepare("DELETE FROM admin_identity_sessions WHERE token_hash=?").bind(hash).run(); return null; }
  return row;
}

async function sha256Hex(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest].map(b => b.toString(16).padStart(2,"0")).join("");
}

function json(data,status=200) {
  return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}

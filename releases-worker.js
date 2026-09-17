const RELEASE_REPO = "Yukidev-404/MELO-Desktop";
const GITHUB_API = `https://api.github.com/repos/${RELEASE_REPO}`;

function githubHeaders(env, accept = "application/vnd.github+json") {
  const headers = {
    Accept: accept,
    "User-Agent": "MELO-Website-Release-Archive",
    "X-GitHub-Api-Version": "2022-11-28"
  };
  if (env?.MELO_GITHUB_TOKEN) headers.Authorization = `Bearer ${env.MELO_GITHUB_TOKEN}`;
  return headers;
}

async function github(env, path, accept = "application/vnd.github+json") {
  const response = await fetch(`${GITHUB_API}${path}`, {
    headers: githubHeaders(env, accept),
    redirect: "manual"
  });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (!location) throw new Error("GitHub API redirect missing location");
    // GitHub release asset endpoints redirect to a signed download URL. Never
    // forward the private repository token to that CDN URL.
    return fetch(location, { redirect: "follow", headers: { Accept: accept, "User-Agent": "MELO-Website-Release-Archive" } });
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response;
}

async function getReleases(env) {
  const response = await github(env, "/releases?per_page=20");
  const releases = await response.json();
  return Array.isArray(releases) ? releases.filter(r => !r.draft && !r.prerelease) : [];
}

function releasePayload(releases, limit) {
  return releases.slice(0, limit).map(r => ({
    id: r.id, name: r.name || r.tag_name || "MELO Desktop", tag_name: r.tag_name,
    body: r.body || "", created_at: r.created_at, published_at: r.published_at,
    prerelease: Boolean(r.prerelease),
    assets: (r.assets || []).map(a => ({ id: a.id, name: a.name, size: a.size, content_type: a.content_type, download_count: a.download_count }))
  }));
}

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}

function validAssetName(name) {
  return typeof name === "string" && name.length <= 256 && !name.includes("/") && !name.includes("\\") && !name.includes("\0");
}

function allowedAsset(name) {
  return typeof name === "string" && /\.(exe|msi|zip)$/i.test(name);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/releases") {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405);
      try {
        const rawLimit = Number(url.searchParams.get("limit") || 20);
        const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? Math.floor(rawLimit) : 20, 1), 20);
        const releases = await getReleases(env);
        return json({ ok: true, repository: RELEASE_REPO, releases: releasePayload(releases, limit) }, 200, { "Cache-Control": "public, max-age=300, s-maxage=300" });
      } catch (error) {
        console.error("MELO release archive API failed", error);
        return json({ ok: false, error: "Release service unavailable." }, 502);
      }
    }

    if (url.pathname === "/download/latest" || url.pathname.startsWith("/download/release/")) {
      if (request.method !== "GET" && request.method !== "HEAD") return json({ error: "Method not allowed." }, 405);
      try {
        const releases = await getReleases(env);
        let release;
        if (url.pathname === "/download/latest") release = releases[0];
        else {
          const id = decodeURIComponent(url.pathname.split("/").pop() || "");
          if (!/^\d+$/.test(id)) return json({ error: "Invalid release ID." }, 400);
          release = releases.find(r => String(r.id) === id);
        }
        if (!release) return json({ error: "No published MELO release found." }, 404);

        const requested = url.searchParams.get("asset");
        if (requested && !validAssetName(requested)) return json({ error: "Invalid asset name." }, 400);
        if (requested && !allowedAsset(requested)) return json({ error: "Asset type is not allowed." }, 400);

        const assets = Array.isArray(release.assets) ? release.assets : [];
        const asset = (requested && assets.find(a => a.name === requested && allowedAsset(a.name))) || assets.find(a => /\.exe$/i.test(a.name)) || assets.find(a => /\.(msi|zip)$/i.test(a.name));
        if (!asset) return json({ error: "No downloadable Windows asset found in this release." }, 404);

        const upstream = await github(env, `/releases/assets/${asset.id}`, "application/octet-stream");
        if (!upstream.ok) return json({ error: "Download source unavailable." }, 502);
        const headers = new Headers(upstream.headers);
        headers.set("Content-Disposition", `attachment; filename="${asset.name.replace(/[^a-zA-Z0-9._-]/g, "_")}"`);
        headers.set("Cache-Control", "public, max-age=300, s-maxage=300");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.delete("set-cookie");
        headers.delete("authorization");
        if (request.method === "HEAD") return new Response(null, { status: upstream.status, headers });
        return new Response(upstream.body, { status: upstream.status, headers });
      } catch (error) {
        console.error("MELO release download failed", error);
        return json({ error: "Download service unavailable." }, 502);
      }
    }
    return json({ error: "Not found." }, 404);
  }
};

import adminWorker from './admin-chat-worker.js';
import profileWorker from './profile-worker.js';
import playerStatsWorker from './player-stats-adapter.js';
import releasesWorker from './releases-worker.js';

function htmlResponse(body, asset) {
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.delete('Content-Length');
  return new Response(body, { status: asset.status, headers });
}

async function serveGetMelo(request, env) {
  const assetUrl = new URL(request.url);
  assetUrl.pathname = '/get-melo.html';
  const asset = await env.ASSETS.fetch(new Request(assetUrl.toString(), request));
  if (!asset.ok) return asset;
  let body = await asset.text();
  body = body.replace(/\/get-melo-releases\.js\?v=[^"']+/g, '/get-melo-releases.js?v=20260916-4');
  if (!body.includes('get-melo-releases.js')) {
    body = body.replace(/<\/body>/i, '<script src="/get-melo-releases.js?v=20260916-4"></script></body>');
  }
  return htmlResponse(body, asset);
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/releases' || path === '/download/latest' || path.startsWith('/download/release/')) return releasesWorker.fetch(request, env, ctx);
    if (path === '/get-melo' || path === '/get-melo/' || path === '/get-melo.html' || path === '/get-melo.html/') return serveGetMelo(request, env);
    if (path.startsWith('/api/auth/')) return env.AUTH.fetch(request);
    if (path === '/api/profile') return profileWorker.fetch(request, env, ctx);
    if (path === '/api/stats' || path === '/api/stats/event') return playerStatsWorker.fetch(request, env, ctx);
    return adminWorker.fetch(request, env, ctx);
  }
};
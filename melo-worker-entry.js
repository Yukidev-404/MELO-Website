import adminWorker from './admin-chat-worker.js';
import profileWorker from './profile-worker.js';
import playerStatsWorker from './player-stats-adapter.js';
import releasesWorker from './releases-worker.js';

function secureResponse(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function htmlResponse(body, asset) {
  const headers = new Headers(asset.headers);
  headers.set('Content-Type', 'text/html; charset=UTF-8');
  headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  headers.set('Pragma', 'no-cache');
  headers.set('Expires', '0');
  headers.delete('Content-Length');
  return secureResponse(new Response(body, { status: asset.status, headers }));
}

async function serveGetMelo(request, env) {
  const asset = await env.ASSETS.fetch(new Request(request.url, request));
  if (!asset.ok) return secureResponse(asset);
  let body = await asset.text();
  body = body.replace(/\/get-melo-releases\.js\?v=[^"']+/g, '/get-melo-releases.js?v=20260916-4');
  body = body.replace(/https:\/\/github\.com\/Yukidev-404\/MELO-Desktop\/releases\/download\/v1\.0\.0\/MELO\.exe/g, '/download.html?latest=1');
  body = body.replace(/https:\/\/github\.com\/Yukidev-404\/MELO-Desktop\/releases\/tag\/v1\.0\.0/g, 'previous-releases.html');
  if (!body.includes('get-melo-releases.js')) {
    body = body.replace(/<\/body>/i, '<script src="/get-melo-releases.js?v=20260916-4"></script></body>');
  }
  return htmlResponse(body, asset);
}

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    let response;
    if (path === '/api/releases' || path === '/download/latest' || path.startsWith('/download/release/')) response = await releasesWorker.fetch(request, env, ctx);
    else if (path === '/get-melo' || path === '/get-melo/' || path === '/get-melo.html' || path === '/get-melo.html/') response = await serveGetMelo(request, env);
    else if (path.startsWith('/api/auth/')) response = await env.AUTH.fetch(request);
    else if (path === '/api/profile') response = await profileWorker.fetch(request, env, ctx);
    else if (path === '/api/stats' || path === '/api/stats/event') response = await playerStatsWorker.fetch(request, env, ctx);
    else response = await adminWorker.fetch(request, env, ctx);
    return secureResponse(response);
  }
};

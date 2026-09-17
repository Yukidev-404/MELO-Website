const FRONTEND_ORIGIN = 'https://yukidev-404.github.io';
const now = () => Math.floor(Date.now() / 1000);
const id = () => crypto.randomUUID();

function cors(request) {
  const origin = request.headers.get('Origin');
  return origin === FRONTEND_ORIGIN
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
        'Vary': 'Origin'
      }
    : {};
}

function json(data, status = 200, request = null) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      ...(request ? cors(request) : {})
    }
  });
}

async function account(request, env) {
  try {
    if (!env.AUTH) return null;
    const headers = new Headers();
    const cookie = request.headers.get('Cookie');
    const authorization = request.headers.get('Authorization');
    if (cookie) headers.set('Cookie', cookie);
    if (authorization) headers.set('Authorization', authorization);
    const r = new Request('https://melo-auth.internal/api/auth/me', { method: 'GET', headers });
    const response = await env.AUTH.fetch(r);
    if (!response.ok) return null;
    const data = await response.json().catch(() => null);
    return data?.authenticated && data?.user?.id ? data.user : null;
  } catch (error) {
    console.error('MELO stats auth error', error);
    return null;
  }
}

async function schema(env) {
  await env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS melo_listening_events (event_id TEXT PRIMARY KEY,user_id TEXT NOT NULL,track_id TEXT,track_name TEXT,artist_name TEXT,album_name TEXT,cover_url TEXT,duration_ms INTEGER NOT NULL DEFAULT 0,played_at INTEGER NOT NULL,source TEXT NOT NULL DEFAULT 'desktop',liked INTEGER NOT NULL DEFAULT 0)`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_melo_listening_user_time ON melo_listening_events(user_id,played_at)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_melo_listening_user_artist ON melo_listening_events(user_id,artist_name)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_melo_listening_user_track ON melo_listening_events(user_id,track_id)')
  ]);
}

function normalizeSource(value) {
  const s = String(value || '').trim().toLowerCase();
  if (s === 'web' || s === 'browser') return 'web';
  if (s === 'desktop' || s === 'windows' || s === 'app') return 'desktop';
  return 'unknown';
}

const text = (value, max) => String(value ?? '').trim().slice(0, max);

async function stats(request, env) {
  const user = await account(request, env);
  if (!user) return json({ authenticated: false, error: 'MELO session could not be verified.' }, 401, request);
  if (!env.DB) return json({ error: 'Listening stats database is not configured.' }, 503, request);

  await schema(env);
  const uid = String(user.id);
  const totals = await env.DB.prepare('SELECT COUNT(*) tracks,COALESCE(SUM(duration_ms),0) duration_ms,COUNT(DISTINCT CASE WHEN liked=1 THEN track_id END) liked FROM melo_listening_events WHERE user_id=?').bind(uid).first();
  const artists = await env.DB.prepare("SELECT artist_name name,COUNT(*) value FROM melo_listening_events WHERE user_id=? AND artist_name IS NOT NULL AND artist_name<>'' GROUP BY artist_name ORDER BY value DESC LIMIT 5").bind(uid).all();
  const song = await env.DB.prepare("SELECT track_name name,artist_name artist,cover_url cover,COUNT(*) plays FROM melo_listening_events WHERE user_id=? AND track_name IS NOT NULL AND track_name<>'' GROUP BY track_name,artist_name,cover_url ORDER BY plays DESC,MAX(played_at) DESC LIMIT 1").bind(uid).first();
  const album = await env.DB.prepare("SELECT album_name name,artist_name artist,cover_url cover,COUNT(*) plays FROM melo_listening_events WHERE user_id=? AND album_name IS NOT NULL AND album_name<>'' GROUP BY album_name,artist_name,cover_url ORDER BY plays DESC,MAX(played_at) DESC LIMIT 1").bind(uid).first();
  const recent = await env.DB.prepare('SELECT track_name name,artist_name artist,played_at time,source FROM melo_listening_events WHERE user_id=? ORDER BY played_at DESC LIMIT 4').bind(uid).all();
  const latest = await env.DB.prepare('SELECT track_name name,artist_name artist,played_at,duration_ms,source FROM melo_listening_events WHERE user_id=? ORDER BY played_at DESC LIMIT 1').bind(uid).first();
  const latestPlayed = Number(latest?.played_at || 0);
  const durationSeconds = Math.max(90, Math.floor(Number(latest?.duration_ms || 0) / 1000) + 30);
  const active = latestPlayed > 0 && now() <= latestPlayed + durationSeconds;
  const source = normalizeSource(latest?.source);

  const daysRows = await env.DB.prepare("SELECT DISTINCT date(played_at,'unixepoch') day FROM melo_listening_events WHERE user_id=? ORDER BY day DESC LIMIT 366").bind(uid).all();
  const days = new Set((daysRows.results || []).map(r => r.day));
  let streak = 0;
  if (latestPlayed) {
    let d = new Date(latestPlayed * 1000);
    for (let i = 0; i < 366; i++) {
      if (!days.has(d.toISOString().slice(0, 10))) break;
      streak++;
      d.setUTCDate(d.getUTCDate() - 1);
    }
  }

  return json({
    authenticated: true,
    profile: { id: user.id, email: user.email, name: user.display_name, displayName: user.display_name, avatarUrl: user.avatar_url },
    listening: { active, source: active && source !== 'unknown' ? source : null, playedAt: latestPlayed || null, trackName: active ? latest?.name || null : null, artist: active ? latest?.artist || null : null },
    stats: {
      minutes: Math.floor(Number(totals?.duration_ms || 0) / 60000), tracks: Number(totals?.tracks || 0), liked: Number(totals?.liked || 0), streak,
      topArtists: artists.results || [],
      recent: (recent.results || []).map(r => ({ name: r.name, artist: r.artist, time: r.time, source: normalizeSource(r.source), text: `Played ${r.name || 'Unknown track'}${r.artist ? ` — ${r.artist}` : ''}` }))
    },
    topArtists: artists.results || [], topGenres: [], mostPlayedSong: song || {}, mostPlayedAlbum: album || {},
    recentActivity: (recent.results || []).map(r => ({ text: `Played ${r.name || 'Unknown track'}${r.artist ? ` — ${r.artist}` : ''}`, name: r.name, artist: r.artist, time: new Date(Number(r.time || 0) * 1000).toLocaleString(), source: normalizeSource(r.source), icon: '♫' }))
  }, 200, request);
}

async function event(request, env) {
  const user = await account(request, env);
  if (!user) return json({ authenticated: false, error: 'MELO session could not be verified.' }, 401, request);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 32768) return json({ error: 'Event payload is too large.' }, 413, request);

  let b;
  try {
    b = await request.json();
  } catch {
    return json({ error: 'Invalid JSON payload.' }, 400, request);
  }
  if (!b || typeof b !== 'object' || Array.isArray(b)) return json({ error: 'Invalid event payload.' }, 400, request);

  const type = text(b?.event_type || b?.eventType || 'play', 32).toLowerCase();
  const track = b?.track && typeof b.track === 'object' && !Array.isArray(b.track) ? b.track : b;
  const trackId = text(track?.id || track?.uri || track?.path || '', 512);
  const name = text(track?.name || track?.title || '', 300);
  if (!name) return json({ error: 'Track name is required.' }, 400, request);

  await schema(env);
  const uid = String(user.id);
  if (type === 'favorite' || type === 'unfavorite') {
    await env.DB.prepare('UPDATE melo_listening_events SET liked=? WHERE user_id=? AND track_id=?').bind(type === 'favorite' ? 1 : 0, uid, trackId).run();
    return json({ ok: true, updated: true }, 200, request);
  }

  const durationRaw = Number(b?.duration_ms || b?.durationMs || track?.duration_ms || track?.durationMs || track?.duration * 1000 || 0);
  const duration = Number.isFinite(durationRaw) ? Math.max(0, Math.min(86400000, durationRaw)) : 0;
  const source = normalizeSource(b?.source || b?.platform || track?.source || track?.platform);
  const playedRaw = Number(b?.played_at || b?.playedAt || now());
  const playedAt = Number.isFinite(playedRaw) ? Math.max(0, Math.min(now() + 86400, Math.floor(playedRaw))) : now();
  const eventId = text(b?.event_id || b?.eventId || id(), 128);
  const artist = text(track?.artist || track?.artistName || '', 300);
  const album = text(track?.album || track?.albumName || '', 300);
  const cover = text(track?.cover || track?.coverUrl || track?.imageUrl || '', 2048);

  await env.DB.prepare('INSERT OR IGNORE INTO melo_listening_events (event_id,user_id,track_id,track_name,artist_name,album_name,cover_url,duration_ms,played_at,source,liked) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(eventId, uid, trackId, name, artist, album, cover, Math.floor(duration), playedAt, source, b?.liked ? 1 : 0).run();
  return json({ ok: true }, 201, request);
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(request) });
    const url = new URL(request.url);
    if (url.pathname === '/api/stats' && request.method === 'GET') return stats(request, env);
    if (url.pathname === '/api/stats/event' && request.method === 'POST') return event(request, env);
    return json({ error: 'Not found.' }, 404, request);
  }
};

import statsWorker from './stats-worker.js';

export default {
  async fetch(request, env, ctx) {
    const response = await statsWorker.fetch(request, env, ctx);
    if (new URL(request.url).pathname !== '/api/stats' || !response.ok) return response;

    const data = await response.json().catch(() => null);
    if (!data || !data.stats) return new Response(JSON.stringify(data || {}), {
      status: response.status,
      headers: response.headers
    });

    data.stats.top_artists = data.topArtists || data.stats.top_artists || [];
    data.stats.recent = data.recentActivity || data.stats.recent || [];
    data.stats.recently_played = data.stats.recent;
    data.stats.recent_tracks = data.stats.recent;
    data.stats.minutes_listened = data.stats.minutes;
    data.stats.tracks_played = data.stats.tracks;
    data.stats.songs_liked = data.stats.liked;
    data.stats.day_streak = data.stats.streak;

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: response.headers
    });
  }
};

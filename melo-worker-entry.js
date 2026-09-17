import adminWorker from './admin-chat-worker.js';
import profileWorker from './profile-worker.js';
import playerStatsWorker from './player-stats-adapter.js';

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/profile') return profileWorker.fetch(request, env, ctx);
    if (path === '/api/stats' || path === '/api/stats/event') return playerStatsWorker.fetch(request, env, ctx);
    return adminWorker.fetch(request, env, ctx);
  }
};

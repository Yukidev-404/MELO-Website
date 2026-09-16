import adminWorker from './admin-chat-worker.js';
import profileWorker from './profile-worker.js';
export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path === '/api/profile') return profileWorker.fetch(request, env, ctx);
    return adminWorker.fetch(request, env, ctx);
  }
};

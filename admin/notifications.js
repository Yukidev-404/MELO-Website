(() => {
  const POLL_MS = 10000;
  const API_BASE = '/api/admin/notifications';

  function getNav() {
    return {
      crashes: document.querySelector('.nav-item[data-view="crashes"]'),
      bugReports: document.querySelector('.nav-item[data-view="bug-reports"]')
    };
  }

  function addDot(item, type) {
    if (!item) return;
    item.classList.add('has-notification');
    let dot = item.querySelector('.nav-notification-dot');
    if (!dot) {
      dot = document.createElement('i');
      dot.setAttribute('aria-hidden', 'true');
      item.appendChild(dot);
    }
    dot.className = `nav-notification-dot ${type}`;
  }

  function clearDot(item) {
    if (!item) return;
    item.classList.remove('has-notification');
    item.querySelector('.nav-notification-dot')?.remove();
  }

  async function check() {
    try {
      const r = await fetch(`${API_BASE}?v=${Date.now()}`, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' }
      });
      if (!r.ok) return;
      const data = await r.json();
      const unread = data?.unread || {};
      const nav = getNav();

      if (Number(unread.crashes || 0) > 0) addDot(nav.crashes, 'crash');
      else clearDot(nav.crashes);

      if (Number(unread.bugReports || 0) > 0) addDot(nav.bugReports, 'bug');
      else clearDot(nav.bugReports);
    } catch {}
  }

  function start() {
    check();
    setInterval(() => {
      if (document.visibilityState === 'visible') check();
    }, POLL_MS);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();

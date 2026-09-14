(() => {
  const POLL_MS = 10000;
  const NOTIFICATION_API = `/api/admin/notifications?v=20260914-2`;
  const nav = {
    crashes: document.querySelector('.nav-item[data-view="crashes"]'),
    'bug-reports': document.querySelector('.nav-item[data-view="bug-reports"]')
  };
  if (!nav.crashes && !nav['bug-reports']) return;

  function addDot(item, type) {
    if (!item) return;
    item.classList.add('has-notification');
    let dot = item.querySelector('.nav-notification-dot');
    if (!dot) {
      dot = document.createElement('i');
      dot.className = 'nav-notification-dot';
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
      const r = await fetch(NOTIFICATION_API, {
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      if (!r.ok) return;
      const data = await r.json();
      const unread = data?.unread || {};

      if (Number(unread.crashes || 0) > 0) addDot(nav.crashes, 'crash');
      else clearDot(nav.crashes);

      if (Number(unread.bugReports || 0) > 0) addDot(nav['bug-reports'], 'bug');
      else clearDot(nav['bug-reports']);
    } catch {}
  }

  check();
  setInterval(() => {
    if (document.visibilityState === 'visible') check();
  }, POLL_MS);
})();

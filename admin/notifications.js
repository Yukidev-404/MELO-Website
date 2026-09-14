(() => {
  const POLL_MS = 10000;
  const STORAGE_KEY = 'melo-control-notification-state-v3';
  const nav = {
    crashes: document.querySelector('.nav-item[data-view="crashes"]'),
    'bug-reports': document.querySelector('.nav-item[data-view="bug-reports"]')
  };
  if (!nav.crashes && !nav['bug-reports']) return;

  const state = (() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch { return {}; }
  })();
  let initialized = false;

  async function getRows(path) {
    try {
      const r = await fetch(path, { credentials: 'include', cache: 'no-store' });
      if (r.status === 401 || !r.ok) return null;
      const d = await r.json();
      return Array.isArray(d.rows) ? d.rows : [];
    } catch { return null; }
  }

  function toTimestamp(value) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && value.trim() !== '') return numeric;
      const parsed = Date.parse(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  }

  function newestTimestamp(rows, type) {
    const key = type === 'crash' ? 'timestamp' : 'submitted_at';
    return rows.reduce((max, r) => Math.max(max, toTimestamp(r[key])), 0);
  }

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

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  async function check() {
    const [crashes, bugs] = await Promise.all([
      getRows('/api/admin/crashes'),
      getRows('/api/admin/bug-reports')
    ]);

    const crashNewest = crashes ? newestTimestamp(crashes, 'crash') : 0;
    const bugNewest = bugs ? newestTimestamp(bugs, 'bug') : 0;

    if (!initialized) {
      if (crashes) state.crashObservedAt = crashNewest;
      if (bugs) state.bugObservedAt = bugNewest;
      save();
      initialized = true;
    }

    if (crashes && crashNewest > Number(state.crashSeenAt || 0)) {
      addDot(nav.crashes, 'crash');
      state.crashObservedAt = crashNewest;
    }
    if (bugs && bugNewest > Number(state.bugSeenAt || 0)) {
      addDot(nav['bug-reports'], 'bug');
      state.bugObservedAt = bugNewest;
    }
    save();
  }

  function bindClear(item, key) {
    if (!item) return;
    item.addEventListener('click', () => {
      clearDot(item);
      if (key === 'crashes' && state.crashObservedAt) state.crashSeenAt = state.crashObservedAt;
      if (key === 'bug-reports' && state.bugObservedAt) state.bugSeenAt = state.bugObservedAt;
      save();
    });
  }

  bindClear(nav.crashes, 'crashes');
  bindClear(nav['bug-reports'], 'bug-reports');
  check();
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, POLL_MS);
})();

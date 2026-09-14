(() => {
  const POLL_MS = 30000;
  const STORAGE_KEY = 'melo-control-notification-state-v1';
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
      const r = await fetch(path, { credentials:'include', cache:'no-store' });
      if (r.status === 401) return null;
      if (!r.ok) return null;
      const d = await r.json();
      return Array.isArray(d.rows) ? d.rows : [];
    } catch { return null; }
  }

  function newestId(rows, key) {
    return rows
      .map(r => String(r[key] || ''))
      .filter(Boolean)
      .sort()
      .slice(-1)[0] || '';
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

    if (!initialized) {
      if (crashes) state.crashBaseline = newestId(crashes, 'crash_id');
      if (bugs) state.bugBaseline = newestId(bugs, 'report_id');
      save();
      initialized = true;
      return;
    }

    if (crashes) {
      const newest = newestId(crashes, 'crash_id');
      if (newest && state.crashBaseline && newest !== state.crashBaseline) addDot(nav.crashes, 'crash');
      if (newest) state.crashBaseline = newest;
    }
    if (bugs) {
      const newest = newestId(bugs, 'report_id');
      if (newest && state.bugBaseline && newest !== state.bugBaseline) addDot(nav['bug-reports'], 'bug');
      if (newest) state.bugBaseline = newest;
    }
    save();
  }

  function bindClear(item, key) {
    if (!item) return;
    item.addEventListener('click', () => {
      clearDot(item);
      if (key === 'crashes') state.crashBaseline = state.crashBaseline || '';
      if (key === 'bug-reports') state.bugBaseline = state.bugBaseline || '';
      save();
    });
  }

  bindClear(nav.crashes, 'crashes');
  bindClear(nav['bug-reports'], 'bug-reports');
  check();
  setInterval(() => { if (document.visibilityState === 'visible') check(); }, POLL_MS);
})();

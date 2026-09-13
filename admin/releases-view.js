(() => {
  const content = document.getElementById('page-content');
  let timer;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '—';

  function isView() { return new URLSearchParams(location.search).get('view') === 'releases'; }
  async function load() {
    if (!isView()) return;
    try {
      const d = await window.api('/api/admin/releases');
      const rows = d.rows || d.releases || [];
      const active = rows.filter(r => String(r.release_status || '').toLowerCase() === 'active');
      const platforms = new Set(rows.map(r => r.platform).filter(Boolean)).size;
      content.innerHTML = `<section class="page">
        <div class="page-intro"><h2>Release Management</h2><p>Production versions, builds and rollout state recorded in D1.</p></div>
        <section class="metrics">
          <article class="metric"><small>TOTAL RELEASES</small><strong>${rows.length}</strong><span class="delta">Recorded versions</span></article>
          <article class="metric"><small>ACTIVE</small><strong>${active.length}</strong><span class="delta">Currently active</span></article>
          <article class="metric"><small>PLATFORMS</small><strong>${platforms}</strong><span class="delta">Release targets</span></article>
          <article class="metric"><small>LATEST</small><strong>${esc(rows[0]?.version || '—')}</strong><span class="delta">Most recent record</span></article>
        </section>
        <section class="panel"><div class="panel-head"><h2>Release ledger</h2><span>LIVE D1 DATA</span></div>
          <div class="release-list">${rows.length ? rows.map(r => {
            const status = String(r.release_status || 'unknown').toLowerCase();
            const build = r.build || '';
            const target = encodeURIComponent(JSON.stringify({version:r.version || '',build,platform:r.platform || ''}));
            const action = status === 'active'
              ? `<button class="release-action secondary" data-release-status="archived" data-release-target="${target}">ARCHIVE</button>`
              : `<button class="release-action" data-release-status="active" data-release-target="${target}">ACTIVATE</button><button class="release-action secondary" data-release-status="staged" data-release-target="${target}">STAGE</button>`;
            return `<article class="release-card">
              <div class="release-main"><div><span class="release-version">${esc(r.version)}</span><span class="release-build">BUILD ${esc(r.build || '—')}</span></div><span class="release-status ${status==='active'?'good':''}">${esc(status.toUpperCase())}</span></div>
              <div class="release-meta"><span>${esc(r.platform || '—')}</span><span>${esc(date(r.released_at))}</span></div>
              ${r.release_notes ? `<p class="release-notes">${esc(r.release_notes)}</p>` : '<p class="release-notes muted">No release notes recorded.</p>'}
              <div class="release-actions" aria-label="Release rollout controls">${action}</div>
            </article>`;
          }).join('') : '<div class="empty">No releases have been recorded yet.</div>'}</div>
        </section>
        <div class="health-strip"><span><strong>ROLLOUT CONTROLS ACTIVE.</strong> Activating a release archives the previous active release for the same platform.</span><span class="right">UPDATED ${esc(date(d.generatedAt || Math.floor(Date.now()/1000)))}</span></div>
      </section>`;
      bindActions();
    } catch (e) {
      content.innerHTML = `<section class="page"><div class="empty-state"><strong>Could not load releases.</strong><span>${esc(e.message)}</span></div></section>`;
    }
  }

  async function setStatus(button) {
    if (button.disabled) return;
    let target;
    try { target = JSON.parse(decodeURIComponent(button.dataset.releaseTarget || '')); } catch { return; }
    const status = button.dataset.releaseStatus;
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'SAVING…';
    try {
      const response = await fetch('/api/admin/release-status', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({...target, status})
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) { location.href = '../admin-login.html'; return; }
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      await load();
    } catch (e) {
      button.disabled = false;
      button.textContent = label;
      const message = document.createElement('div');
      message.className = 'release-action-error';
      message.textContent = e.message || 'Unable to update release status.';
      button.closest('.release-card')?.appendChild(message);
      setTimeout(() => message.remove(), 4500);
    }
  }

  function bindActions() {
    content.querySelectorAll('[data-release-status]').forEach(button => button.addEventListener('click', () => setStatus(button)));
  }

  function start() { clearInterval(timer); load(); timer = setInterval(load, 30000); }
  window.addEventListener('popstate', start);
  document.addEventListener('click', e => { if (e.target.closest('[data-view="releases"]')) setTimeout(start, 0); });
  if (isView()) start();
})();

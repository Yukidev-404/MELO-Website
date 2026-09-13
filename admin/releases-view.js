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
          <div class="release-list">${rows.length ? rows.map(r => `<article class="release-card">
            <div class="release-main"><div><span class="release-version">${esc(r.version)}</span><span class="release-build">BUILD ${esc(r.build || '—')}</span></div><span class="release-status ${String(r.release_status).toLowerCase()==='active'?'good':''}">${esc(String(r.release_status || 'unknown').toUpperCase())}</span></div>
            <div class="release-meta"><span>${esc(r.platform || '—')}</span><span>${esc(date(r.released_at))}</span></div>
            ${r.release_notes ? `<p class="release-notes">${esc(r.release_notes)}</p>` : '<p class="release-notes muted">No release notes recorded.</p>'}
          </article>`).join('') : '<div class="empty">No releases have been recorded yet.</div>'}</div>
        </section>
        <div class="health-strip"><span><strong>LIVE D1 DATA.</strong> Release records are informational until a rollout control is added.</span><span class="right">UPDATED ${esc(date(d.generatedAt || Math.floor(Date.now()/1000)))}</span></div>
      </section>`;
    } catch (e) {
      content.innerHTML = `<section class="page"><div class="empty-state"><strong>Could not load releases.</strong><span>${esc(e.message)}</span></div></section>`;
    }
  }
  function start() { clearInterval(timer); load(); timer = setInterval(load, 30000); }
  window.addEventListener('popstate', start);
  document.addEventListener('click', e => { if (e.target.closest('[data-view="releases"]')) setTimeout(start, 0); });
  if (isView()) start();
})();

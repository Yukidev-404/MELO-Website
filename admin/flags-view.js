(() => {
  const render = async () => {
    const params = new URLSearchParams(location.search);
    if ((params.get('view') || 'dashboard') !== 'flags') return;
    const content = document.getElementById('page-content');
    if (!content || typeof api !== 'function') return;
    try {
      const d = await api('/api/admin/flags');
      const rows = d.rows || [];
      const enabled = rows.filter(r => Number(r.enabled)).length;
      content.innerHTML = `<section class="page flags-page"><div class="page-intro"><h2>Feature Flags</h2><p>Controlled product switches stored in D1. Changes are intentionally explicit and auditable.</p></div><section class="metrics">${metric('TOTAL FLAGS', rows.length, 'Configured switches')}${metric('ENABLED', enabled, 'Currently ON')}${metric('DISABLED', rows.length-enabled, 'Currently OFF')}${metric('CONTROL MODE', 'D1', 'Server-side state')}</section><section class="panel"><div class="panel-head"><h2>Flag registry</h2><span>LIVE D1 DATA</span></div><div class="flag-list">${rows.length ? rows.map(r => `<article class="flag-card"><div class="flag-main"><div><code>${esc(r.flag_key)}</code><p>${esc(r.description || 'No description')}</p></div><div class="flag-state ${Number(r.enabled)?'on':'off'}"><i></i>${Number(r.enabled)?'ENABLED':'DISABLED'}</div></div><div class="flag-meta"><span>UPDATED ${esc(date(r.updated_at))}</span><span>CREATED ${esc(date(r.created_at))}</span></div></article>`).join('') : '<div class="empty">No feature flags configured.</div>'}</div></section><div class="health-strip"><span><strong>READ-ONLY CONTROL VIEW.</strong> Editing will be enabled only after a dedicated mutation/audit path is in place.</span><span class="right">${rows.length} FLAG${rows.length===1?'':'S'}</span></div></section>`;
    } catch (e) {
      content.innerHTML = `<section class="page"><div class="empty">Unable to load feature flags. ${esc(e.message)}</div></section>`;
    }
  };
  window.addEventListener('popstate', render);
  const oldPush = history.pushState; history.pushState = function(){ const r=oldPush.apply(this, arguments); setTimeout(render,0); return r; };
  const oldReplace = history.replaceState; history.replaceState = function(){ const r=oldReplace.apply(this, arguments); setTimeout(render,0); return r; };
  setTimeout(render, 0);
})();

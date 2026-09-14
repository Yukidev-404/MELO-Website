(() => {
  const content = document.getElementById('page-content');
  if (!content) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty = v => typeof v === 'object' && v !== null ? JSON.stringify(v, null, 2) : String(v ?? '—');

  async function load() {
    if (new URLSearchParams(location.search).get('view') !== 'services') return;
    try {
      const r = await fetch('/api/admin/services', {credentials:'include', cache:'no-store'});
      if (r.status === 401) return;
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      const d = await r.json();
      render(d);
    } catch (e) {
      content.innerHTML = `<section class="page services-page"><div class="page-intro"><h2>API / Services</h2><p>Current control-plane and telemetry service status.</p></div><div class="panel"><div class="empty">Unable to load service status. ${esc(e.message)}</div></div></section>`;
    }
  }

  function render(d) {
    const entries = Object.entries(d || {});
    const rows = entries.length ? entries.map(([key, value]) => {
      const text = pretty(value);
      const simple = typeof value !== 'object' || value === null;
      return `<div class="service-row"><div><strong>${esc(key.replace(/[_-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase()))}</strong><span>${simple ? esc(text) : esc(text.slice(0,220))}</span></div><b>${simple ? 'OK' : 'DETAILS'}</b></div>`;
    }).join('') : '<div class="empty">No service status data returned.</div>';
    content.innerHTML = `<section class="page services-page"><div class="page-intro"><h2>API / Services</h2><p>Current control-plane and telemetry service status.</p></div><section class="panel"><div class="panel-head"><h2>Service Status</h2><span>LIVE API</span></div><div class="service-list">${rows}</div></section><div class="health-strip"><span><strong>SERVICE LAYER.</strong> Status is read from the protected admin endpoint.</span><span class="right">LIVE</span></div></section>`;
  }

  let last = '';
  const tick = () => { const key = location.search; if (key !== last) { last = key; load(); } };
  tick();
  setInterval(tick, 500);
  setInterval(() => { if (new URLSearchParams(location.search).get('view') === 'services') load(); }, 30000);
})();

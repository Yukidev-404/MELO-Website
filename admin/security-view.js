(() => {
  const content = document.getElementById('page-content');
  if (!content) return;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '—';
  const nowSec = () => Math.floor(Date.now() / 1000);

  async function load() {
    if (new URLSearchParams(location.search).get('view') !== 'security') return;
    try {
      const r = await fetch('/api/admin/security', {credentials:'include', cache:'no-store'});
      if (r.status === 401) return;
      if (!r.ok) throw new Error(`Request failed (${r.status})`);
      const d = await r.json();
      render(d);
    } catch (e) {
      content.innerHTML = `<section class="page"><div class="page-intro"><h2>Security Center</h2><p>Protected administrative activity and authentication state.</p></div><div class="panel"><div class="empty">Unable to load security data.</div></div></section>`;
    }
  }

  function render(d) {
    const attempts = d.attempts || [];
    const admin = d.admin || {};
    const active = Number(admin.activeSessions || 0);
    const failed = Number(admin.failedAuthWindows || 0);
    const telemetry = attempts.filter(x => String(x.key || '').startsWith('telemetry')).length;
    const attention = attempts.filter(x => Number(x.count || 0) >= 5).length;
    const setup = !!admin.setupComplete;

    const attemptRows = attempts.length ? attempts.map((r, i) => {
      const key = String(r.key || '');
      const type = key.startsWith('login:') ? 'ADMIN AUTHENTICATION' : key.startsWith('telemetry-install:') ? 'TELEMETRY BOOTSTRAP' : key.startsWith('telemetry:') ? 'TELEMETRY EVENTS' : 'PROTECTED RATE LIMIT';
      const count = Number(r.count || 0);
      const state = count >= 5 ? '<span class="security-badge warn">ATTENTION</span>' : '<span class="security-badge">NORMAL</span>';
      return `<tr><td class="mono">${esc(date(r.window_start))}</td><td>${esc(type)}</td><td class="mono">${esc(count)}</td><td>${state}</td></tr>`;
    }).join('') : '<tr><td colspan="4"><div class="empty">No recent rate-limit activity.</div></td></tr>';

    content.innerHTML = `<section class="page security-page">
      <div class="page-intro"><h2>Security Center</h2><p>Authentication, sessions and protected rate-limit activity. Secrets and tokens are never displayed here.</p></div>
      <section class="metrics">
        <article class="metric"><small>2FA STATUS</small><strong>${setup ? 'ACTIVE' : 'SETUP REQUIRED'}</strong><span class="delta">Authenticator-based admin login</span></article>
        <article class="metric"><small>ACTIVE SESSIONS</small><strong>${esc(active)}</strong><span class="delta">Protected admin sessions</span></article>
        <article class="metric"><small>AUTH WINDOWS</small><strong>${esc(failed)}</strong><span class="delta">Recent failed-auth counters</span></article>
        <article class="metric"><small>ATTENTION</small><strong>${esc(attention)}</strong><span class="delta">Counters at or above threshold</span></article>
      </section>
      <div class="security-grid">
        <section class="panel security-status-panel"><div class="panel-head"><h2>Security posture</h2><span>LIVE</span></div>
          <div class="security-check"><i></i><div><strong>Admin authentication</strong><span>${setup ? 'TOTP protection is configured.' : 'TOTP setup is not complete.'}</span></div><b>${setup ? 'PROTECTED' : 'ACTION'}</b></div>
          <div class="security-check"><i></i><div><strong>Admin sessions</strong><span>Session cookies are required for protected Control Room APIs.</span></div><b>PROTECTED</b></div>
          <div class="security-check"><i></i><div><strong>Telemetry credentials</strong><span>Client credentials are separate from admin authentication.</span></div><b>SEPARATE</b></div>
          <div class="security-check"><i></i><div><strong>Secret exposure</strong><span>Security view excludes password, TOTP secret and token hashes.</span></div><b>HIDDEN</b></div>
        </section>
        <section class="panel"><div class="panel-head"><h2>Rate-limit activity</h2><span>RECENT WINDOWS</span></div>
          <table class="data-table"><thead><tr><th>WINDOW</th><th>TYPE</th><th>COUNT</th><th>STATE</th></tr></thead><tbody>${attemptRows}</tbody></table>
        </section>
      </div>
      <div class="health-strip"><span><strong>SECURITY LAYER ACTIVE.</strong> ${esc(telemetry)} telemetry-related rate-limit entr${telemetry === 1 ? 'y' : 'ies'} visible.</span><span class="right">UPDATED ${esc(date(nowSec()))}</span></div>
    </section>`;
  }

  let last = '';
  const tick = () => {
    const key = location.search;
    if (key !== last) { last = key; load(); }
  };
  tick();
  setInterval(tick, 500);
  setInterval(() => { if (new URLSearchParams(location.search).get('view') === 'security') load(); }, 30000);
})();

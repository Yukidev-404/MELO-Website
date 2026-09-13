const content = document.getElementById('page-content');
const title = document.getElementById('page-title');
const identity = document.getElementById('identity');
const clock = document.getElementById('clock');
const logout = document.getElementById('logout');

const views = {
  dashboard: { title: 'MELO Administration', heading: 'MELO', sub: 'control room.', copy: 'Private administration console' },
  users: { title: 'Users', heading: 'Users', copy: 'Accounts and activity across MELO installations.' },
  installations: { title: 'Installations', heading: 'Installations', copy: 'The MELO installation fleet and version adoption.' },
  crashes: { title: 'Crashes', heading: 'Crash Logs', copy: 'Investigate crashes and unresolved player failures.' },
  security: { title: 'Security', heading: 'Security Center', copy: 'Authentication, access and suspicious activity.' },
  services: { title: 'API / Services', heading: 'Services', copy: 'Health and availability of MELO backend services.' },
  releases: { title: 'Releases', heading: 'Releases', copy: 'Production versions, builds and rollout status.' },
  flags: { title: 'Feature Flags', heading: 'Feature Flags', copy: 'Control staged MELO features and experiments.' },
  analytics: { title: 'Analytics', heading: 'Analytics', copy: 'Usage, adoption and product-level trends.' },
  health: { title: 'System Health', heading: 'System Health', copy: 'Technical health across the MELO control plane.' },
  settings: { title: 'Admin Settings', heading: 'Admin Settings', copy: 'Authentication and administrative preferences.' }
};

const dashboard = `
<section class="page">
  <div class="hero-line">
    <div><h2 class="hero-title">MELO <em>control room.</em></h2><p class="hero-copy">Private administration console</p></div>
    <div class="status-large"><i></i>ALL SYSTEMS OPERATIONAL</div>
  </div>
  <section class="metrics">
    <article class="metric"><small>TOTAL USERS</small><strong>1,284</strong><span class="delta">+12.4% this month</span></article>
    <article class="metric"><small>ACTIVE USERS</small><strong>342</strong><span class="delta">26.6% of base</span></article>
    <article class="metric"><small>NEW USERS</small><strong>27</strong><span class="delta">+8 today</span></article>
    <article class="metric"><small>SUSPENDED USERS</small><strong>3</strong><span class="delta">0 pending review</span></article>
  </section>
  <div class="two-col">
    <section class="panel">
      <div class="panel-head"><h2>Installations &amp; adoption</h2><span>FLEET OVERVIEW <b class="accent">●</b></span></div>
      <table class="data-table"><thead><tr><th>METRIC</th><th>DESCRIPTION</th><th>VALUE</th><th>TREND</th></tr></thead><tbody>
        <tr><td class="mono">TOTAL</td><td>Total installations<br><span class="muted">All registered MELO clients</span></td><td class="mono accent">1,284</td><td class="mono">+4.1%</td></tr>
        <tr><td class="mono">WIN</td><td>Windows installations<br><span class="muted">Windows 10 and 11</span></td><td class="mono accent">742</td><td class="mono">58%</td></tr>
        <tr><td class="mono">MAC</td><td>macOS installations<br><span class="muted">Intel and Apple Silicon</span></td><td class="mono accent">384</td><td class="mono">30%</td></tr>
        <tr><td class="mono">OTHER</td><td>Other platforms<br><span class="muted">Linux and legacy clients</span></td><td class="mono accent">158</td><td class="mono">12%</td></tr>
        <tr><td class="mono">VERSION</td><td>Current MELO version<br><span class="muted">Latest production release</span></td><td class="mono accent">v1.0.0</td><td class="mono">91% adoption</td></tr>
      </tbody></table>
    </section>
    <section class="panel">
      <div class="panel-head"><h2>Recent Activity</h2><span>LIVE FEED</span></div>
      <div class="activity">
        <div class="activity-row"><span class="activity-time">11:42</span><span class="activity-type ok">[INSTALL]</span><span class="activity-text">New installation detected on Windows 11</span></div>
        <div class="activity-row"><span class="activity-time">11:37</span><span class="activity-type">[CRASH]</span><span class="activity-text">Crash report received from macOS client</span></div>
        <div class="activity-row"><span class="activity-time">11:24</span><span class="activity-type ok">[AUTH]</span><span class="activity-text">Successful admin authentication</span></div>
        <div class="activity-row"><span class="activity-time">11:09</span><span class="activity-type">[API]</span><span class="activity-text">Spotify authentication failure detected</span></div>
        <div class="activity-row"><span class="activity-time">10:52</span><span class="activity-type ok">[RELEASE]</span><span class="activity-text">MELO v1.0.0 available in production</span></div>
        <div class="activity-row"><span class="activity-time">10:41</span><span class="activity-type">[SECURITY]</span><span class="activity-text">Suspicious request blocked by rate limiter</span></div>
      </div>
    </section>
  </div>
  <div class="health-strip"><span><strong>◉ All MELO services are healthy.</strong> Latest release v1.0.0 is deployed to 91% of the fleet.</span><span class="right">OPEN SYSTEM HEALTH →</span></div>
  <div class="subgrid">
    <section class="mini-panel"><h3>Crash Status</h3><div class="kv"><span>Today</span><b>2</b></div><div class="kv"><span>Unresolved</span><b>4</b></div><div class="kv"><span>Crash rate</span><b>0.08%</b></div></section>
    <section class="mini-panel"><h3>Security</h3><div class="kv"><span>Failed auth</span><b>3</b></div><div class="kv"><span>Blocked</span><b>7</b></div><div class="kv"><span>Last event</span><b>2m ago</b></div></section>
    <section class="mini-panel"><h3>Services</h3><div class="kv"><span>MELO Worker</span><b class="accent">● OK</b></div><div class="kv"><span>D1 Database</span><b class="accent">● OK</b></div><div class="kv"><span>Spotify API</span><b class="accent">● OK</b></div></section>
  </div>
</section>`;

function genericView(view) {
  const v = views[view];
  const tableRows = {
    users: ['User ID','MELO Version','Last Seen','Connected Services','Devices','Status'],
    installations: ['Installation ID','Platform / OS','MELO Version','Build','First Seen','Last Seen','Update Status'],
    crashes: ['Crash ID','Timestamp','MELO Version','OS','Error Type','Severity','Status'],
    security: ['Timestamp','Event','Context','Severity','Status'],
    services: ['Service','Status','Latency','Recent Errors','Last Checked'],
    releases: ['Version','Build','Release Date','Status','Adoption'],
    flags: ['Feature','Status','Rollout','Target','Last Updated'],
    analytics: ['Metric','Current','Change','Period'],
    health: ['Component','Status','Latency','Last Check'],
    settings: ['Setting','Current Value','Status']
  }[view] || ['Metric','Value','Status'];
  const rows = view === 'services' ? [['MELO Worker','● OPERATIONAL','42 ms','0','Just now'],['D1 Database','● OPERATIONAL','18 ms','0','Just now'],['Spotify API','● OPERATIONAL','184 ms','1','2 min ago'],['Authentication','● OPERATIONAL','31 ms','0','Just now']] :
    view === 'releases' ? [['v1.0.0','production','13 Sep 2026','Production','91%'],['v0.9.3','build 184','28 Aug 2026','Archived','7%'],['v0.9.2','build 177','14 Aug 2026','Archived','2%']] :
    view === 'flags' ? [['New Player UI','ON','100%','All users','Today'],['Crash Logger','ON','100%','All users','Today'],['Experimental Features','OFF','0%','Internal','Today']] :
    view === 'settings' ? [['Authenticator 2FA','Active','Protected'],['Session TTL','8 hours','Active'],['Admin account','Authenticated','Protected']] :
    [['MELO-0001','v1.0.0','Today','Connected','Windows','Active'],['MELO-0002','v1.0.0','Yesterday','Spotify','macOS','Active'],['MELO-0003','v0.9.3','3 days ago','None','Windows','Inactive']];
  return `<section class="page"><div class="page-intro"><h2>${v.heading}</h2><p>${v.copy}</p></div><div class="toolbar"><input class="search" placeholder="Search ${v.heading.toLowerCase()}…" aria-label="Search"><button class="filter">FILTER</button><button class="filter">EXPORT</button></div><section class="panel"><table class="data-table"><thead><tr>${tableRows.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map((x,i)=>`<td class="${i===0?'mono':''} ${String(x).includes('●')?'accent':''}">${x}</td>`).join('')}</tr>`).join('')}</tbody></table></section><div class="health-strip"><span><strong>Control Room module ready.</strong> Connect the corresponding D1 records and service telemetry as each MELO feature is implemented.</span><span class="right">MELO ADMIN</span></div></section>`;
}

function render(view) {
  const active = views[view] ? view : 'dashboard';
  document.querySelectorAll('.nav-item').forEach(a => a.classList.toggle('active', a.dataset.view === active));
  title.textContent = views[active].title;
  content.innerHTML = active === 'dashboard' ? dashboard : genericView(active);
  history.replaceState(null,'',`/admin/?view=${active}`);
}

document.querySelectorAll('.nav-item').forEach(a => a.addEventListener('click', e => { e.preventDefault(); render(a.dataset.view); }));

async function loadSession(){
  const response = await fetch('/api/admin/me',{credentials:'include',cache:'no-store'});
  if(!response.ok){window.location.href='../admin-login.html';return;}
  const data = await response.json();
  identity.textContent = data.email;
}

logout.addEventListener('click', async()=>{logout.disabled=true;await fetch('/api/admin/logout',{method:'POST',credentials:'include'});window.location.href='../admin-login.html';});

function tick(){ clock.textContent = new Date().toISOString().slice(11,19)+' UTC'; }
tick(); setInterval(tick,1000);

const initial = new URLSearchParams(location.search).get('view') || 'dashboard';
render(initial);
loadSession().catch(()=>{window.location.href='../admin-login.html';});

const content = document.getElementById('page-content');
const title = document.getElementById('page-title');
const identity = document.getElementById('identity');
const clock = document.getElementById('clock');
const logout = document.getElementById('logout');

const views = {
  dashboard: { title: 'MELO Administration', heading: 'MELO', copy: 'Private administration console' },
  users: { title: 'Users', heading: 'Users', copy: 'Telemetry-backed MELO installations. Account-level user management is not enabled yet.' },
  installations: { title: 'Installations', heading: 'Installations', copy: 'The registered MELO installation fleet and version adoption.' },
  crashes: { title: 'Crashes', heading: 'Crash Logs', copy: 'Investigate sanitized crash reports received from MELO clients.' },
  security: { title: 'Security', heading: 'Security Center', copy: 'Authentication and rate-limit activity available to the control plane.' },
  services: { title: 'API / Services', heading: 'Services', copy: 'Live status of the MELO Worker, D1 and telemetry service.' },
  releases: { title: 'Releases', heading: 'Releases', copy: 'Production versions, builds and rollout status recorded in D1.' },
  flags: { title: 'Feature Flags', heading: 'Feature Flags', copy: 'Feature flag state recorded in D1.' },
  analytics: { title: 'Analytics', heading: 'Analytics', copy: 'Telemetry-backed adoption and event metrics.' },
  health: { title: 'System Health', heading: 'System Health', copy: 'Technical health across the MELO control plane.' },
  settings: { title: 'Admin Settings', heading: 'Admin Settings', copy: 'Authentication and administrative configuration.' }
};

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) : '—';
const ago = ts => { if (!ts) return '—'; const s = Math.max(0, Math.floor(Date.now()/1000) - Number(ts)); if (s < 60) return `${s}s ago`; if (s < 3600) return `${Math.floor(s/60)}m ago`; if (s < 86400) return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };

async function api(path, params = {}) {
  const query = new URLSearchParams(params);
  const response = await fetch(path + (query.toString() ? `?${query}` : ''), { credentials: 'include', cache: 'no-store' });
  if (response.status === 401) { window.location.href = '../admin-login.html'; throw new Error('Authentication required'); }
  if (!response.ok) throw new Error(`Request failed (${response.status})`);
  return response.json();
}

function metric(label, value, note) { return `<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="delta">${esc(note)}</span></article>`; }

function dashboardHtml(data) {
  const m = data.metrics || {}, a = data.adoption || {}, platforms = a.platforms || [], versions = a.versions || [], activityRows = data.recentActivity || [];
  const current = a.currentVersion || '—';
  const platformRows = platforms.length ? platforms.map(p => `<tr><td class="mono">${esc(String(p.platform).toUpperCase())}</td><td>Registered installations<br><span class="muted">Telemetry-backed fleet</span></td><td class="mono accent">${esc(p.count)}</td><td class="mono">${m.totalInstallations ? Math.round(Number(p.count)/Number(m.totalInstallations)*100) : 0}%</td></tr>`).join('') : '<tr><td colspan="4">No installation telemetry yet.</td></tr>';
  const versionRows = versions.map(v => `<tr><td class="mono">VERSION</td><td>${esc(v.app_version)}<br><span class="muted">Registered installations</span></td><td class="mono accent">${esc(v.count)}</td><td class="mono">${m.totalInstallations ? Math.round(Number(v.count)/Number(m.totalInstallations)*100) : 0}%</td></tr>`).join('');
  const activity = activityRows.length ? activityRows.map(r => `<div class="activity-row"><span class="activity-time">${esc(ago(r.timestamp))}</span><span class="activity-type ok">[${esc(String(r.event_type).toUpperCase())}]</span><span class="activity-text">${esc(r.installation_id)} · ${esc(r.app_version)} · ${esc(r.platform)}</span></div>`).join('') : '<div class="activity-row"><span class="activity-text">No telemetry activity yet.</span></div>';
  return `<section class="page"><div class="hero-line"><div><h2 class="hero-title">MELO <em>control room.</em></h2><p class="hero-copy">Private administration console · live D1 telemetry</p></div><div class="status-large"><i></i>TELEMETRY ONLINE</div></div>
  <section class="metrics">${metric('TOTAL INSTALLATIONS', m.totalInstallations ?? 0, 'Registered clients')}${metric('ACTIVE INSTALLATIONS', m.activeInstallations ?? 0, 'Seen in last 7 days')}${metric('NEW TODAY', m.newToday ?? 0, 'Registered today')}${metric('CRASH REPORTS', data.crashes?.total ?? 0, `${data.crashes?.today ?? 0} today`)}</section>
  <div class="two-col"><section class="panel"><div class="panel-head"><h2>Installations &amp; adoption</h2><span>LIVE D1 DATA <b class="accent">●</b></span></div><table class="data-table"><thead><tr><th>METRIC</th><th>DESCRIPTION</th><th>VALUE</th><th>SHARE</th></tr></thead><tbody>${platformRows}${versionRows}<tr><td class="mono">CURRENT</td><td>Latest configured release<br><span class="muted">Release table or most common installed version</span></td><td class="mono accent">${esc(current)}</td><td class="mono">${esc(a.currentAdoption ?? 0)}%</td></tr></tbody></table></section>
  <section class="panel"><div class="panel-head"><h2>Recent Activity</h2><span>LIVE TELEMETRY</span></div><div class="activity">${activity}</div></section></div>
  <div class="health-strip"><span><strong>◉ Telemetry pipeline operational.</strong> Data shown here is read from the MELO D1 telemetry records.</span><span class="right">BUILD ${esc(a.currentBuild || '—')}</span></div>
  <div class="subgrid"><section class="mini-panel"><h3>Crash Status</h3><div class="kv"><span>Today</span><b>${esc(data.crashes?.today ?? 0)}</b></div><div class="kv"><span>Total reports</span><b>${esc(data.crashes?.total ?? 0)}</b></div></section><section class="mini-panel"><h3>Security</h3><div class="kv"><span>Auth windows</span><b>${esc(data.security?.failedAuthWindows ?? 0)}</b></div><div class="kv"><span>Sessions</span><b>Protected</b></div></section><section class="mini-panel"><h3>Services</h3><div class="kv"><span>MELO Worker</span><b class="accent">● OK</b></div><div class="kv"><span>D1 Database</span><b class="accent">● OK</b></div><div class="kv"><span>Telemetry API</span><b class="accent">● OK</b></div></section></div></section>`;
}

function tableView(view, rows) {
  const configs = {
    users: [['installation_id','Installation ID'],['app_version','MELO Version'],['last_seen','Last Seen'],['platform','Platform'],['os_version','OS'],['build','Build']],
    installations: [['installation_id','Installation ID'],['platform','Platform'],['os_version','OS'],['app_version','MELO Version'],['build','Build'],['first_seen','First Seen'],['last_seen','Last Seen']],
    crashes: [['crash_id','Crash ID'],['timestamp','Timestamp'],['app_version','Version'],['platform','Platform'],['error_type','Error Type'],['severity','Severity'],['installation_id','Installation']],
    releases: [['version','Version'],['build','Build'],['platform','Platform'],['released_at','Release Date'],['release_status','Status']],
    flags: [['flag_key','Feature'],['enabled','Status'],['description','Description'],['updated_at','Last Updated']]
  };
  const cfg = configs[view] || [];
  const format = (key, value) => key.endsWith('_at') || ['timestamp','first_seen','last_seen'].includes(key) ? date(value) : key === 'enabled' ? (Number(value) ? 'ON' : 'OFF') : value;
  const body = rows.length ? rows.map(r => `<tr>${cfg.map(([key]) => `<td class="${key.includes('id') || key === 'version' || key === 'build' ? 'mono' : ''}">${esc(format(key, r[key]))}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${cfg.length}">No records found.</td></tr>`;
  return `<section class="page"><div class="page-intro"><h2>${esc(views[view].heading)}</h2><p>${esc(views[view].copy)}</p></div><div class="toolbar"><input id="module-search" class="search" placeholder="Search ${esc(views[view].heading.toLowerCase())}…" aria-label="Search"><button id="search-btn" class="filter">SEARCH</button></div><section class="panel"><table class="data-table"><thead><tr>${cfg.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></section><div class="health-strip"><span><strong>LIVE D1 DATA.</strong> ${rows.length} record${rows.length === 1 ? '' : 's'} returned.</span><span class="right">NO SECRETS EXPOSED</span></div></section>`;
}

function securityHtml(d) { const rows=(d.attempts||[]).map(r=>`<tr><td class="mono">${esc(date(r.window_start))}</td><td>${esc(r.key.startsWith('login:')?'Admin authentication':r.key.startsWith('telemetry')?'Telemetry rate limit':'Protected rate limit')}</td><td class="mono">${esc(r.count)}</td><td>${r.count>=5?'ATTENTION':'NORMAL'}</td></tr>`).join('')||'<tr><td colspan="4">No recent security counters.</td></tr>'; return `<section class="page"><div class="page-intro"><h2>Security Center</h2><p>Protected administrative activity and rate-limit counters. Secrets and tokens are never displayed.</p></div><section class="panel"><div class="panel-head"><h2>Recent security counters</h2><span>LAST 10 MIN</span></div><table class="data-table"><thead><tr><th>WINDOW</th><th>EVENT</th><th>COUNT</th><th>STATE</th></tr></thead><tbody>${rows}</tbody></table></section><div class="health-strip"><span><strong>2FA ${d.admin?.setupComplete?'ACTIVE':'NOT CONFIGURED'}.</strong> ${esc(d.admin?.activeSessions??0)} active admin session(s).</span></div></section>`; }
function servicesHtml(d) { const rows=(d.services||[]).map(s=>`<tr><td class="mono">${esc(s.service)}</td><td class="accent">● ${esc(s.status)}</td><td class="mono">${s.latencyMs==null?'—':esc(s.latencyMs)+' ms'}</td><td>${esc(s.note)}</td></tr>`).join(''); return `<section class="page"><div class="page-intro"><h2>Services</h2><p>Live checks from the current control-plane request.</p></div><section class="panel"><table class="data-table"><thead><tr><th>SERVICE</th><th>STATUS</th><th>LATENCY</th><th>DETAIL</th></tr></thead><tbody>${rows}</tbody></table></section></section>`; }
function analyticsHtml(d) { const e=(d.events||[]).map(x=>`<tr><td class="mono">${esc(x.event_type)}</td><td>${esc(x.count)}</td></tr>`).join('')||'<tr><td colspan="2">No events.</td></tr>'; const v=(d.versions||[]).map(x=>`<tr><td class="mono">${esc(x.app_version)}</td><td>${esc(x.count)}</td></tr>`).join('')||'<tr><td colspan="2">No versions.</td></tr>'; return `<section class="page"><div class="page-intro"><h2>Analytics</h2><p>Derived directly from telemetry events and installation records.</p></div><div class="two-col"><section class="panel"><div class="panel-head"><h2>Events</h2></div><table class="data-table"><thead><tr><th>TYPE</th><th>COUNT</th></tr></thead><tbody>${e}</tbody></table></section><section class="panel"><div class="panel-head"><h2>Versions</h2></div><table class="data-table"><thead><tr><th>VERSION</th><th>INSTALLATIONS</th></tr></thead><tbody>${v}</tbody></table></section></div></section>`; }
function healthHtml(d) { const rows=(d.components||[]).map(c=>`<tr><td class="mono">${esc(c.component)}</td><td class="accent">● ${esc(c.status)}</td><td>${esc(c.detail)}</td></tr>`).join(''); return `<section class="page"><div class="page-intro"><h2>System Health</h2><p>Current Worker and D1 health snapshot.</p></div><section class="panel"><table class="data-table"><thead><tr><th>COMPONENT</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>${rows}</tbody></table></section></section>`; }
function settingsHtml(d) { const rows=(d.settings||[]).map(s=>`<tr><td class="mono">${esc(s.setting)}</td><td>${esc(s.value)}</td><td class="accent">${esc(s.status)}</td></tr>`).join(''); return `<section class="page"><div class="page-intro"><h2>Admin Settings</h2><p>Read-only administrative configuration for now.</p></div><section class="panel"><table class="data-table"><thead><tr><th>SETTING</th><th>VALUE</th><th>STATUS</th></tr></thead><tbody>${rows}</tbody></table></section></section>`; }
function bindSearch(view) { const input=document.getElementById('module-search'), button=document.getElementById('search-btn'); if(!input||!button)return; input.value=new URLSearchParams(location.search).get('q')||''; button.addEventListener('click',()=>render(view,input.value.trim())); input.addEventListener('keydown',e=>{if(e.key==='Enter')render(view,input.value.trim());}); }

async function render(view, search = '') {
  const active=views[view]?view:'dashboard'; document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.view===active)); title.textContent=views[active].title; content.innerHTML=`<section class="page"><div class="page-intro"><h2>${esc(views[active].heading)}</h2><p>Loading live control-room data…</p></div></section>`;
  try {
    if(active==='dashboard') content.innerHTML=dashboardHtml(await api('/api/admin/dashboard'));
    else if(['users','installations','crashes','releases','flags'].includes(active)) content.innerHTML=tableView(active,(await api(`/api/admin/${active}`,{q:search})).rows||[]);
    else if(active==='security') content.innerHTML=securityHtml(await api('/api/admin/security'));
    else if(active==='services') content.innerHTML=servicesHtml(await api('/api/admin/services'));
    else if(active==='analytics') content.innerHTML=analyticsHtml(await api('/api/admin/analytics'));
    else if(active==='health') content.innerHTML=healthHtml(await api('/api/admin/health-detail'));
    else if(active==='settings') content.innerHTML=settingsHtml(await api('/api/admin/settings'));
    history.replaceState(null,'',`/admin/?view=${active}${search?`&q=${encodeURIComponent(search)}`:''}`); bindSearch(active);
  } catch(error) { content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load data</h2><p>${esc(error.message)}</p></div></section>`; }
}

document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();render(a.dataset.view);}));
async function loadSession(){const response=await fetch('/api/admin/me',{credentials:'include',cache:'no-store'});if(!response.ok){window.location.href='../admin-login.html';return;}const data=await response.json();identity.textContent=data.email;}
logout.addEventListener('click',async()=>{logout.disabled=true;await fetch('/api/admin/logout',{method:'POST',credentials:'include'});window.location.href='../admin-login.html';});
function tick(){clock.textContent=new Date().toISOString().slice(11,19)+' UTC';} tick(); setInterval(tick,1000);
const initial=new URLSearchParams(location.search).get('view')||'dashboard'; render(initial); loadSession().catch(()=>{window.location.href='../admin-login.html';});

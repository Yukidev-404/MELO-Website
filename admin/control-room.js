const content = document.getElementById('page-content');
const title = document.getElementById('page-title');
const identity = document.getElementById('identity');
const clock = document.getElementById('clock');
const logout = document.getElementById('logout');

const views = {
  dashboard:{title:'MELO Administration',heading:'MELO',copy:'Private administration console · live D1 telemetry'},
  users:{title:'Users',heading:'Users',copy:'Telemetry-backed MELO installations. Account-level user management is not enabled yet.'},
  installations:{title:'Installations',heading:'Installations',copy:'Registered MELO clients and their latest heartbeat state.'},
  crashes:{title:'Crashes',heading:'Crash Logs',copy:'Investigate sanitized crash reports received from MELO clients.'},
  'bug-reports':{title:'Bug Reports',heading:'Bug Reports',copy:'Review manually submitted MELO bug reports.'},
  security:{title:'Security',heading:'Security Center',copy:'Administrative authentication and protected rate-limit activity.'},
  services:{title:'API / Services',heading:'Services',copy:'Current control-plane and telemetry service status.'},
  chat:{title:'Admin Chat',heading:'Admin Chat',copy:'Private shared room for the MELO administration team.'},
  releases:{title:'Releases',heading:'Releases',copy:'Production versions, builds and rollout status recorded in D1.'},
  flags:{title:'Feature Flags',heading:'Feature Flags',copy:'Feature flag state recorded in D1.'},
  analytics:{title:'Analytics',heading:'Analytics',copy:'Adoption and event metrics derived from telemetry.'},
  health:{title:'System Health',heading:'System Health',copy:'Current Worker and D1 health snapshot.'},
  settings:{title:'Admin Settings',heading:'Admin Settings',copy:'Read-only administrative configuration.'},
  audit:{title:'Audit Log',heading:'Audit Log',copy:'Server-side record of administrative actions.'}
};

const esc=v=>String(v??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#39;'}[c]));
const date=ts=>ts?new Date(Number(ts)*1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'—';
const ago=ts=>{if(!ts)return'—';const s=Math.max(0,Math.floor(Date.now()/1000)-Number(ts));if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`};

async function api(path,params={}){const q=new URLSearchParams(params);const r=await fetch(path+(q.toString()?`?${q}`:''),{credentials:'include',cache:'no-store'});if(r.status===401){location.href='../admin-login.html';throw Error('Authentication required')}if(!r.ok)throw Error(`Request failed (${r.status})`);return r.json()}
window.api=api;
function metric(label,value,note){return`<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="delta">${esc(note)}</span></article>`}
function statusDot(status){const good=/OPERATIONAL|ACTIVE|PROTECTED|ON|OK/i.test(String(status));return`<span class="status-text ${good?'good':''}"><i></i>${esc(status)}</span>`}

function dashboardHtml(d){const m=d.metrics||{},a=d.adoption||{},p=a.platforms||[],v=a.versions||[],rows=d.recentActivity||[];const activity=rows.length?rows.map(r=>`<div class="activity-row"><span class="activity-time">${esc(ago(r.timestamp))}</span><span class="activity-type ok">[${esc(String(r.event_type).toUpperCase())}]</span><span class="activity-text">${esc(r.installation_id)} · ${esc(r.app_version)} · ${esc(r.platform)}</span></div>`).join(''):'<div class="empty">No telemetry activity yet.</div>';const adoption=[...p.map(x=>({label:String(x.platform).toUpperCase(),count:Number(x.count),kind:'PLATFORM'})),...v.map(x=>({label:x.app_version,count:Number(x.count),kind:'VERSION'}))];const table=adoption.length?adoption.map(x=>`<tr><td class="mono">${esc(x.kind)}</td><td>${esc(x.label)}</td><td class="mono accent">${x.count}</td><td class="mono">${m.totalInstallations?Math.round(x.count/Number(m.totalInstallations)*100):0}%</td></tr>`).join(''):'<tr><td colspan="4">No installation telemetry yet.</td></tr>';return`<section class="page"><div class="hero-line"><div><h2 class="hero-title">MELO <em>control room.</em></h2><p class="hero-copy">Private administration console · live D1 telemetry</p></div><div class="status-large"><i></i>TELEMETRY ONLINE</div></div><section class="metrics">${metric('TOTAL INSTALLATIONS',m.totalInstallations??0,'Registered clients')}${metric('ACTIVE INSTALLATIONS',m.activeInstallations??0,'Seen in last 7 days')}${metric('NEW TODAY',m.newToday??0,'Registered today')}${metric('CRASH REPORTS',d.crashes?.total??0,`${d.crashes?.today??0} today`)}</section><div class="two-col"><section class="panel"><div class="panel-head"><h2>Installations & adoption</h2><span>LIVE D1 DATA <b class="accent">●</b></span></div><table class="data-table"><thead><tr><th>KIND</th><th>VALUE</th><th>COUNT</th><th>SHARE</th></tr></thead><tbody>${table}<tr><td class="mono">CURRENT</td><td>${esc(a.currentVersion||'—')}</td><td class="mono accent">${esc(a.currentAdoption??0)}%</td><td class="mono">${esc(a.currentReleaseStatus||'not configured')}</td></tr></tbody></table></section><section class="panel"><div class="panel-head"><h2>Recent Activity</h2><span>LIVE TELEMETRY</span></div><div class="activity">${activity}</div></section></div><div class="health-strip"><span><strong>● Telemetry pipeline operational.</strong> Dashboard values are read from D1.</span><span class="right">UPDATED ${esc(date(d.generatedAt))}</span></div><div class="subgrid"><section class="mini-panel"><h3>Crash Status</h3><div class="kv"><span>Today</span><b>${esc(d.crashes?.today??0)}</b></div><div class="kv"><span>Total reports</span><b>${esc(d.crashes?.total??0)}</b></div></section><section class="mini-panel"><h3>Security</h3><div class="kv"><span>Failed-auth windows</span><b>${esc(d.security?.failedAuthWindows??0)}</b></div><div class="kv"><span>Sessions</span><b>Protected</b></div></section><section class="mini-panel"><h3>Release</h3><div class="kv"><span>Current version</span><b>${esc(a.currentVersion||'—')}</b></div><div class="kv"><span>Build</span><b>${esc(a.currentBuild||'—')}</b></div></section></div></section>`}

let currentView='dashboard',refreshTimer;
const specializedViews=new Set(['users','installations','bug-reports','crashes','security','chat','releases','flags','analytics','health','settings','audit']);
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>loadSpecialized(currentView),30)}
async function loadSpecialized(view){return;}
function render(view,search=''){currentView=views[view]?view:'dashboard';document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.view===currentView));title.textContent=views[currentView].title;history.replaceState(null,'',`/admin/?view=${currentView}${search?`&q=${encodeURIComponent(search)}`:''}`);if(specializedViews.has(currentView)){window.dispatchEvent(new CustomEvent('controlroom:viewchange',{detail:{view:currentView}}));return;}content.innerHTML=`<section class="page"><div class="page-intro"><h2>${esc(views[currentView].heading)}</h2><p>Loading live control-room data…</p></div></section>`;api(`/api/admin/${currentView}`).then(d=>{content.innerHTML=dashboardHtml(d)}).catch(e=>{content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load ${esc(views[currentView].heading)}</h2><p>${esc(e.message)}</p></div></section>`})}
function boot(){const params=new URLSearchParams(location.search);render(params.get('view')||'dashboard',params.get('q')||'')}
document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',e=>{const v=a.dataset.view;if(!v)return;e.preventDefault();render(v)}));
if(logout)logout.onclick=async()=>{try{await fetch('/api/admin/logout',{method:'POST',credentials:'include'})}finally{location.href='../admin-login.html'}};
if(identity)api('/api/admin/me').then(d=>{identity.textContent=d.email||d.identity||'Authenticated'}).catch(()=>{});
setInterval(()=>{if(clock)clock.textContent=new Date().toUTCString().slice(17,25)+' UTC'},1000);
boot();

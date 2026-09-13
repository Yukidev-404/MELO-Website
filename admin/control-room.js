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
  security:{title:'Security',heading:'Security Center',copy:'Administrative authentication and protected rate-limit activity.'},
  services:{title:'API / Services',heading:'Services',copy:'Current control-plane and telemetry service status.'},
  releases:{title:'Releases',heading:'Releases',copy:'Production versions, builds and rollout status recorded in D1.'},
  flags:{title:'Feature Flags',heading:'Feature Flags',copy:'Feature flag state recorded in D1.'},
  analytics:{title:'Analytics',heading:'Analytics',copy:'Adoption and event metrics derived from telemetry.'},
  health:{title:'System Health',heading:'System Health',copy:'Current Worker and D1 health snapshot.'},
  settings:{title:'Admin Settings',heading:'Admin Settings',copy:'Read-only administrative configuration.'}
};

const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date=ts=>ts?new Date(Number(ts)*1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}):'—';
const ago=ts=>{if(!ts)return'—';const s=Math.max(0,Math.floor(Date.now()/1000)-Number(ts));if(s<60)return`${s}s ago`;if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`};

async function api(path,params={}){
  const q=new URLSearchParams(params);
  const r=await fetch(path+(q.toString()?`?${q}`:''),{credentials:'include',cache:'no-store'});
  if(r.status===401){location.href='../admin-login.html';throw Error('Authentication required')}
  if(!r.ok)throw Error(`Request failed (${r.status})`);
  return r.json();
}
function metric(label,value,note){return`<article class="metric"><small>${esc(label)}</small><strong>${esc(value)}</strong><span class="delta">${esc(note)}</span></article>`}
function statusDot(status){const good=/OPERATIONAL|ACTIVE|PROTECTED|ON|OK/i.test(String(status));return`<span class="status-text ${good?'good':''}"><i></i>${esc(status)}</span>`}

function dashboardHtml(d){
  const m=d.metrics||{},a=d.adoption||{},p=a.platforms||[],v=a.versions||[],rows=d.recentActivity||[];
  const activity=rows.length?rows.map(r=>`<div class="activity-row"><span class="activity-time">${esc(ago(r.timestamp))}</span><span class="activity-type ok">[${esc(String(r.event_type).toUpperCase())}]</span><span class="activity-text">${esc(r.installation_id)} · ${esc(r.app_version)} · ${esc(r.platform)}</span></div>`).join(''):'<div class="empty">No telemetry activity yet.</div>';
  const adoption=[...p.map(x=>({label:String(x.platform).toUpperCase(),count:Number(x.count),kind:'PLATFORM'})),...v.map(x=>({label:x.app_version,count:Number(x.count),kind:'VERSION'}))];
  const table=adoption.length?adoption.map(x=>`<tr><td class="mono">${esc(x.kind)}</td><td>${esc(x.label)}</td><td class="mono accent">${x.count}</td><td class="mono">${m.totalInstallations?Math.round(x.count/Number(m.totalInstallations)*100):0}%</td></tr>`).join(''):'<tr><td colspan="4">No installation telemetry yet.</td></tr>';
  return`<section class="page"><div class="hero-line"><div><h2 class="hero-title">MELO <em>control room.</em></h2><p class="hero-copy">Private administration console · live D1 telemetry</p></div><div class="status-large"><i></i>TELEMETRY ONLINE</div></div>
  <section class="metrics">${metric('TOTAL INSTALLATIONS',m.totalInstallations??0,'Registered clients')}${metric('ACTIVE INSTALLATIONS',m.activeInstallations??0,'Seen in last 7 days')}${metric('NEW TODAY',m.newToday??0,'Registered today')}${metric('CRASH REPORTS',d.crashes?.total??0,`${d.crashes?.today??0} today`)}</section>
  <div class="two-col"><section class="panel"><div class="panel-head"><h2>Installations & adoption</h2><span>LIVE D1 DATA <b class="accent">●</b></span></div><table class="data-table"><thead><tr><th>KIND</th><th>VALUE</th><th>COUNT</th><th>SHARE</th></tr></thead><tbody>${table}<tr><td class="mono">CURRENT</td><td>${esc(a.currentVersion||'—')}</td><td class="mono accent">${esc(a.currentAdoption??0)}%</td><td class="mono">${esc(a.currentReleaseStatus||'not configured')}</td></tr></tbody></table></section>
  <section class="panel"><div class="panel-head"><h2>Recent Activity</h2><span>LIVE TELEMETRY</span></div><div class="activity">${activity}</div></section></div>
  <div class="health-strip"><span><strong>● Telemetry pipeline operational.</strong> Dashboard values are read from D1.</span><span class="right">UPDATED ${esc(date(d.generatedAt))}</span></div>
  <div class="subgrid"><section class="mini-panel"><h3>Crash Status</h3><div class="kv"><span>Today</span><b>${esc(d.crashes?.today??0)}</b></div><div class="kv"><span>Total reports</span><b>${esc(d.crashes?.total??0)}</b></div></section><section class="mini-panel"><h3>Security</h3><div class="kv"><span>Failed-auth windows</span><b>${esc(d.security?.failedAuthWindows??0)}</b></div><div class="kv"><span>Sessions</span><b>Protected</b></div></section><section class="mini-panel"><h3>Release</h3><div class="kv"><span>Current version</span><b>${esc(a.currentVersion||'—')}</b></div><div class="kv"><span>Build</span><b>${esc(a.currentBuild||'—')}</b></div></section></div></section>`;
}

const configs={
 users:[['installation_id','Installation ID'],['app_version','MELO Version'],['last_seen','Last Seen'],['platform','Platform'],['os_version','OS'],['build','Build']],
 installations:[['installation_id','Installation ID'],['platform','Platform'],['os_version','OS'],['app_version','MELO Version'],['build','Build'],['first_seen','First Seen'],['last_seen','Last Seen']],
 crashes:[['crash_id','Crash ID'],['timestamp','Timestamp'],['app_version','Version'],['platform','Platform'],['error_type','Error Type'],['severity','Severity'],['installation_id','Installation']],
 releases:[['version','Version'],['build','Build'],['platform','Platform'],['released_at','Release Date'],['release_status','Status']],
 flags:[['flag_key','Feature'],['enabled','Status'],['description','Description'],['updated_at','Last Updated']]
};
function format(key,v){return key.endsWith('_at')||['timestamp','first_seen','last_seen'].includes(key)?date(v):key==='enabled'?(Number(v)?'ON':'OFF'):v}
function tableView(view,rows){
 const cfg=configs[view]||[];
 const body=rows.length?rows.map((r,i)=>`<tr class="data-row" data-row="${i}">${cfg.map(([k])=>`<td class="${k.includes('id')||['version','build'].includes(k)?'mono':''}">${esc(format(k,r[k]))}</td>`).join('')}</tr>`).join(''):`<tr><td colspan="${cfg.length}"><div class="empty">No records found.</div></td></tr>`;
 return`<section class="page"><div class="page-intro"><h2>${esc(views[view].heading)}</h2><p>${esc(views[view].copy)}</p></div><div class="toolbar"><input id="module-search" class="search" placeholder="Search ${esc(view)}…"><button id="search-btn" class="filter">SEARCH</button>${rows.length?`<button id="export-btn" class="filter">EXPORT CSV</button>`:''}</div><section class="panel"><table class="data-table"><thead><tr>${cfg.map(([,label])=>`<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${body}</tbody></table></section><div class="health-strip"><span><strong>LIVE D1 DATA.</strong> ${rows.length} record${rows.length===1?'':'s'} returned.</span><span class="right">CLICK A ROW FOR DETAILS</span></div></section>`;
}
function detailModal(titleText,rows,kind){
 const r=rows;let html='';
 if(kind==='crash')html=`<div class="detail-grid"><div><small>CRASH ID</small><code>${esc(r.crash_id)}</code></div><div><small>INSTALLATION</small><code>${esc(r.installation_id)}</code></div><div><small>VERSION / BUILD</small><code>${esc(r.app_version)} · ${esc(r.build||'—')}</code></div><div><small>TIME</small><code>${esc(date(r.timestamp))}</code></div><div class="detail-wide"><small>ERROR</small><code>${esc(r.error_type||'—')}</code></div><div class="detail-wide"><small>MESSAGE</small><pre>${esc(r.message||'—')}</pre></div><div class="detail-wide"><small>SANITIZED STACK TRACE</small><pre>${esc(r.stack_trace||'—')}</pre></div></div>`;
 else html=`<div class="detail-grid"><div><small>INSTALLATION ID</small><code>${esc(r.installation_id)}</code></div><div><small>PLATFORM</small><code>${esc(r.platform)}</code></div><div><small>MELO VERSION</small><code>${esc(r.app_version)}</code></div><div><small>BUILD</small><code>${esc(r.build||'—')}</code></div><div><small>FIRST SEEN</small><code>${esc(date(r.first_seen))}</code></div><div><small>LAST SEEN</small><code>${esc(date(r.last_seen))} · ${esc(ago(r.last_seen))}</code></div><div><small>OS</small><code>${esc(r.os_version||'—')}</code></div><div><small>CLIENT SCHEMA</small><code>${esc(r.client_schema)}</code></div></div>`;
 document.body.insertAdjacentHTML('beforeend',`<div class="modal-backdrop" id="detail-modal"><div class="modal"><div class="modal-head"><div><small>CONTROL ROOM DETAIL</small><h2>${esc(titleText)}</h2></div><button class="modal-close" id="modal-close">×</button></div>${html}</div></div>`);
 document.getElementById('modal-close').onclick=()=>document.getElementById('detail-modal')?.remove();document.getElementById('detail-modal').onclick=e=>{if(e.target.id==='detail-modal')e.currentTarget.remove()};
}
function bindTableRows(view,rows){document.querySelectorAll('.data-row').forEach(row=>row.addEventListener('click',()=>detailModal(view==='crashes'?'Crash Report':'Installation',rows[Number(row.dataset.row)],view==='crashes'?'crash':'installation')))}
function exportCsv(view,rows){const cfg=configs[view]||[];const csv=[cfg.map(x=>x[1]),...rows.map(r=>cfg.map(([k])=>`"${String(format(k,r[k])??'').replace(/"/g,'""')}"`))].map(x=>x.join(',')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv],{type:'text/csv'}));a.download=`melo-${view}.csv`;a.click();URL.revokeObjectURL(a.href)}

function securityHtml(d){const rows=d.attempts||[];return`<section class="page"><div class="page-intro"><h2>Security Center</h2><p>Protected administrative activity and rate-limit counters. Secrets and tokens are never displayed.</p></div><section class="panel"><div class="panel-head"><h2>Recent counters</h2><span>LAST 10 MIN</span></div><table class="data-table"><thead><tr><th>WINDOW</th><th>EVENT</th><th>COUNT</th><th>STATE</th></tr></thead><tbody>${rows.length?rows.map(r=>`<tr><td class="mono">${esc(date(r.window_start))}</td><td>${r.key.startsWith('login:')?'Admin authentication':r.key.startsWith('telemetry')?'Telemetry rate limit':'Protected rate limit'}</td><td class="mono">${esc(r.count)}</td><td>${r.count>=5?'ATTENTION':'NORMAL'}</td></tr>`).join(''):'<tr><td colspan="4">No recent security counters.</td></tr>'}</tbody></table></section><div class="health-strip"><span><strong>2FA ${d.admin?.setupComplete?'ACTIVE':'NOT CONFIGURED'}.</strong> ${esc(d.admin?.activeSessions??0)} active admin session(s).</span></div></section>`}
function servicesHtml(d){return`<section class="page"><div class="page-intro"><h2>Services</h2><p>Live checks from the current control-plane request.</p></div><section class="panel"><table class="data-table"><thead><tr><th>SERVICE</th><th>STATUS</th><th>LATENCY</th><th>DETAIL</th></tr></thead><tbody>${(d.services||[]).map(s=>`<tr><td class="mono">${esc(s.service)}</td><td>${statusDot(s.status)}</td><td class="mono">${s.latencyMs==null?'—':esc(s.latencyMs)+' ms'}</td><td>${esc(s.note)}</td></tr>`).join('')}</tbody></table></section></section>`}
function healthHtml(d){return`<section class="page"><div class="page-intro"><h2>System Health</h2><p>Current Worker and D1 health snapshot.</p></div><section class="panel"><table class="data-table"><thead><tr><th>COMPONENT</th><th>STATUS</th><th>DETAIL</th></tr></thead><tbody>${(d.components||[]).map(c=>`<tr><td class="mono">${esc(c.component)}</td><td>${statusDot(c.status)}</td><td>${esc(c.detail)}</td></tr>`).join('')}</tbody></table></section></section>`}
function settingsHtml(d){return`<section class="page"><div class="page-intro"><h2>Admin Settings</h2><p>Read-only administrative configuration for now.</p></div><section class="panel"><table class="data-table"><thead><tr><th>SETTING</th><th>VALUE</th><th>STATUS</th></tr></thead><tbody>${(d.settings||[]).map(s=>`<tr><td class="mono">${esc(s.setting)}</td><td>${esc(s.value)}</td><td class="accent">${esc(s.status)}</td></tr>`).join('')}</tbody></table></section></section>`}

let currentView='dashboard',refreshTimer;
async function render(view,search=''){
 currentView=views[view]?view:'dashboard';document.querySelectorAll('.nav-item').forEach(a=>a.classList.toggle('active',a.dataset.view===currentView));title.textContent=views[currentView].title;
 const specializedViews=new Set(['analytics']);
 if(!specializedViews.has(currentView))content.innerHTML=`<section class="page"><div class="page-intro"><h2>${esc(views[currentView].heading)}</h2><p>Loading live control-room data…</p></div></section>`;
 try{
  let rows=null,data;
  if(currentView==='dashboard')data=await api('/api/admin/dashboard');
  else if(['users','installations','crashes','releases','flags'].includes(currentView)){data=await api(`/api/admin/${currentView}`,{q:search});rows=data.rows||[];content.innerHTML=tableView(currentView,rows);bindTableRows(currentView,rows);bindSearch(currentView);}
  else if(currentView==='security')content.innerHTML=securityHtml(await api('/api/admin/security'));
  else if(currentView==='services')content.innerHTML=servicesHtml(await api('/api/admin/services'));
  else if(currentView==='health')content.innerHTML=healthHtml(await api('/api/admin/health-detail'));
  else if(currentView==='settings')content.innerHTML=settingsHtml(await api('/api/admin/settings'));
  if(currentView==='dashboard')content.innerHTML=dashboardHtml(data);
  if(rows){const e=document.getElementById('export-btn');if(e)e.onclick=()=>exportCsv(currentView,rows)}
  history.replaceState(null,'',`/admin/?view=${currentView}${search?`&q=${encodeURIComponent(search)}`:''}`);
 }catch(e){if(!specializedViews.has(currentView))content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load data</h2><p>${esc(e.message)}</p></div></section>`}
 scheduleRefresh();
}
function bindSearch(view){const i=document.getElementById('module-search'),b=document.getElementById('search-btn');if(!i||!b)return;i.value=new URLSearchParams(location.search).get('q')||'';b.onclick=()=>render(view,i.value.trim());i.onkeydown=e=>{if(e.key==='Enter')render(view,i.value.trim())}}
function scheduleRefresh(){clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>{if(document.visibilityState==='visible')render(currentView,new URLSearchParams(location.search).get('q')||'')},30000)}

document.querySelectorAll('.nav-item').forEach(a=>a.addEventListener('click',e=>{e.preventDefault();render(a.dataset.view)}));
async function loadSession(){const r=await fetch('/api/admin/me',{credentials:'include',cache:'no-store'});if(!r.ok){location.href='../admin-login.html';return}const d=await r.json();identity.textContent=d.email}
logout.onclick=async()=>{logout.disabled=true;await fetch('/api/admin/logout',{method:'POST',credentials:'include'});location.href='../admin-login.html'};
function tick(){clock.textContent=new Date().toISOString().slice(11,19)+' UTC'}tick();setInterval(tick,1000);loadSession().catch(()=>location.href='../admin-login.html');render(new URLSearchParams(location.search).get('view')||'dashboard');

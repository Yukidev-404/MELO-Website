(() => {
  const content = document.getElementById('page-content');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '—';
  const ago = ts => { if (!ts) return '—'; const s=Math.max(0,Math.floor(Date.now()/1000)-Number(ts)); if(s<60)return `${s}s ago`; if(s<3600)return `${Math.floor(s/60)}m ago`; if(s<86400)return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
  const active = ts => Number(ts) >= Math.floor(Date.now()/1000) - 7 * 86400;
  const api = async (path, params={}) => { const q=new URLSearchParams(params); const r=await fetch(path+(q.toString()?`?${q}`:''),{credentials:'include',cache:'no-store'}); if(r.status===401){location.href='../admin-login.html';throw Error('Authentication required')} if(!r.ok)throw Error(`Request failed (${r.status})`); return r.json(); };

  function metricCards(rows){
    const now=Math.floor(Date.now()/1000);
    const activeCount=rows.filter(r=>Number(r.last_seen)>=now-7*86400).length;
    const recent=rows.filter(r=>Number(r.last_seen)>=now-86400).length;
    const versions=new Set(rows.map(r=>r.app_version).filter(Boolean)).size;
    return `<div class="metrics installations-metrics"><article class="metric"><small>TOTAL INSTALLATIONS</small><strong>${rows.length}</strong><span class="delta">Returned by D1</span></article><article class="metric"><small>ACTIVE</small><strong>${activeCount}</strong><span class="delta">Seen in last 7 days</span></article><article class="metric"><small>LAST 24 HOURS</small><strong>${recent}</strong><span class="delta">Recent heartbeat state</span></article><article class="metric"><small>VERSIONS</small><strong>${versions}</strong><span class="delta">Distinct client versions</span></article></div>`;
  }

  function render(rows, query=''){
    const body=rows.length?rows.map((r,i)=>{const ok=active(r.last_seen);return `<tr class="data-row installation-detail-row" data-index="${i}"><td class="mono">${esc(r.installation_id)}</td><td><strong>${esc(r.app_version)}</strong><small class="cell-sub">build ${esc(r.build||'—')}</small></td><td class="mono">${esc(r.platform)}<small class="cell-sub">${esc(r.os_version||'—')}</small></td><td><span class="status-text ${ok?'good':''}"><i></i>${ok?'ACTIVE':'INACTIVE'}</span><small class="cell-sub">${esc(ago(r.last_seen))}</small></td><td class="mono">${esc(date(r.first_seen))}</td><td class="mono">${esc(date(r.last_seen))}</td></tr>`}).join(''):`<tr><td colspan="6"><div class="empty">No installations found.</div></td></tr>`;
    content.innerHTML=`<section class="page"><div class="page-intro"><h2>Installations</h2><p>Registered MELO clients, heartbeat state and telemetry history. Click an installation to inspect its operational record.</p></div>${metricCards(rows)}<div class="toolbar"><input id="installations-search" class="search" value="${esc(query)}" placeholder="Search installation, version, build, OS…"><button id="installations-search-btn" class="filter">SEARCH</button><button id="installations-export-btn" class="filter">EXPORT CSV</button></div><section class="panel"><div class="panel-head"><h2>Installation Fleet</h2><span>${rows.length} RECORD${rows.length===1?'':'S'} · LIVE D1</span></div><table class="data-table"><thead><tr><th>INSTALLATION</th><th>VERSION</th><th>PLATFORM / OS</th><th>TELEMETRY</th><th>FIRST SEEN</th><th>LAST SEEN</th></tr></thead><tbody>${body}</tbody></table></section><div class="health-strip"><span><strong>OPERATIONAL VIEW.</strong> Installation IDs are opaque client identifiers; account identity is not collected.</span><span class="right">CLICK A ROW FOR TELEMETRY</span></div></section>`;
    document.querySelectorAll('.installation-detail-row').forEach(row=>row.addEventListener('click',()=>showDetail(rows[Number(row.dataset.index)])));
    const search=document.getElementById('installations-search');
    document.getElementById('installations-search-btn').onclick=()=>load(search.value.trim());
    search.onkeydown=e=>{if(e.key==='Enter')document.getElementById('installations-search-btn').click()};
    document.getElementById('installations-export-btn').onclick=()=>exportCsv(rows);
  }

  function exportCsv(rows){
    const headers=['Installation ID','MELO Version','Build','Platform','OS','Telemetry Status','First Seen','Last Seen'];
    const lines=[headers,...rows.map(r=>[r.installation_id,r.app_version,r.build,r.platform,r.os_version,active(r.last_seen)?'ACTIVE':'INACTIVE',date(r.first_seen),date(r.last_seen)])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));a.download='melo-installations.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function closeDetail(){document.getElementById('installation-detail-overlay')?.remove()}

  function eventIcon(type){
    const icons={install:'↓',heartbeat:'·',version:'↗',crash:'×'};
    return icons[type] || '•';
  }

  function eventClass(type){return ['install','heartbeat','version','crash'].includes(type)?type:'default'}

  async function showDetail(row){
    const overlay=document.createElement('div');
    overlay.id='installation-detail-overlay';
    overlay.className='installation-overlay';
    overlay.innerHTML=`<div role="dialog" aria-modal="true" class="installation-modal"><header class="installation-modal-head"><div><div class="installation-eyebrow">INSTALLATION DETAIL</div><div class="installation-title-row"><span class="installation-pulse"></span><h2>${esc(row.installation_id)}</h2></div><p class="installation-subtitle">Operational telemetry record · ${esc(row.platform || 'unknown platform')}</p></div><button id="installation-detail-close" class="installation-close" type="button" aria-label="Close installation detail">CLOSE</button></header><div id="installation-detail-body" class="installation-detail-body"><div class="detail-loading"><span class="loading-line"></span><span class="loading-line short"></span><span class="loading-line"></span></div></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('installation-detail-close').onclick=closeDetail;
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeDetail()});
    const onKey=e=>{if(e.key==='Escape')closeDetail()};
    document.addEventListener('keydown',onKey,{once:true});
    try{
      const d=await api('/api/admin/installation',{id:row.installation_id});
      const i=d.installation||row, events=d.events||[], crashes=d.crashes||[], t=d.telemetry;
      const latestEvent=events[0];
      const eventRows=events.length?events.map(e=>`<article class="timeline-item"><div class="timeline-rail"><span class="timeline-dot ${eventClass(e.event_type)}">${eventIcon(e.event_type)}</span></div><div class="timeline-main"><div class="timeline-top"><span class="event-badge ${eventClass(e.event_type)}">${esc(e.event_type).toUpperCase()}</span><time>${esc(date(e.timestamp))}</time></div><div class="timeline-id">${esc(e.event_id)}</div><div class="timeline-meta"><span>${esc(e.app_version)}</span><span>${esc(e.build||'no build')}</span><span>${esc(e.platform)}</span></div></div></article>`).join(''):`<div class="detail-empty">No telemetry events recorded.</div>`;
      const crashRows=crashes.length?crashes.map(c=>`<article class="crash-card"><div class="crash-card-top"><div><span class="event-badge crash">CRASH</span><strong>${esc(c.error_type||'Unhandled crash')}</strong></div><time>${esc(date(c.timestamp))}</time></div><p>${esc(c.message||'No message supplied.')}</p>${c.stack_trace?`<details><summary>VIEW SANITIZED STACK TRACE</summary><pre>${esc(c.stack_trace)}</pre></details>`:''}</article>`).join(''):`<div class="detail-empty">No crash reports for this installation.</div>`;
      document.getElementById('installation-detail-body').innerHTML=`
        <div class="detail-overview">
          <div class="detail-stat primary"><span>VERSION</span><strong>${esc(i.app_version)}</strong><small>build ${esc(i.build||'—')}</small></div>
          <div class="detail-stat"><span>LAST SEEN</span><strong>${esc(ago(i.last_seen))}</strong><small>${esc(date(i.last_seen))}</small></div>
          <div class="detail-stat"><span>EVENTS</span><strong>${events.length}</strong><small>up to 500 retained</small></div>
          <div class="detail-stat ${crashes.length?'danger':''}"><span>CRASHES</span><strong>${crashes.length}</strong><small>${crashes.length?'requires attention':'no crashes recorded'}</small></div>
        </div>
        <div class="detail-info-grid">
          <div><span>PLATFORM</span><strong>${esc(i.platform)} <em>·</em> ${esc(i.os_version||'—')}</strong></div>
          <div><span>CLIENT SCHEMA</span><strong>${esc(i.client_schema??'—')}</strong></div>
          <div><span>FIRST SEEN</span><strong>${esc(date(i.first_seen))}</strong></div>
          <div><span>TELEMETRY CREDENTIAL</span><strong class="credential-status ${t?.active?'active':''}"><i></i>${t?(t.active?'ACTIVE':'REVOKED'):'NOT ISSUED'}</strong><small>${t?.lastUsedAt?`Last used ${esc(ago(t.lastUsedAt))}`:'No usage recorded'}</small></div>
        </div>
        <div class="detail-section-head"><div><span>ACTIVITY</span><h3>Telemetry Timeline</h3></div><small>${events.length} EVENTS</small></div>
        <section class="timeline-panel">${eventRows}</section>
        <div class="detail-section-head crash-heading"><div><span>DIAGNOSTICS</span><h3>Crash Reports</h3></div><small>${crashes.length} REPORT${crashes.length===1?'':'S'}</small></div>
        <section class="crash-list">${crashRows}</section>
        <footer class="detail-footer"><span>INSTALLATION ID IS AN OPAQUE CLIENT IDENTIFIER</span><span>${latestEvent?`LATEST EVENT · ${esc(ago(latestEvent.timestamp))}`:'NO EVENTS'}</span></footer>`;
    }catch(e){document.getElementById('installation-detail-body').innerHTML=`<div class="detail-error"><span>!</span><div><strong>Unable to load installation telemetry</strong><p>${esc(e.message)}</p></div></div>`}
  }

  async function load(query=''){
    try{const d=await api('/api/admin/installations',{q:query});render(d.rows||[],query)}catch(e){content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load installations</h2><p>${esc(e.message)}</p></div></section>`}
  }
  function maybeEnhance(){const params=new URLSearchParams(location.search);if((params.get('view')||'dashboard')==='installations')load(params.get('q')||'')}
  document.querySelectorAll('.nav-item[data-view="installations"]').forEach(a=>a.addEventListener('click',()=>setTimeout(maybeEnhance,350)));
  window.addEventListener('popstate',()=>setTimeout(maybeEnhance,350));
  setTimeout(maybeEnhance,550);
  setInterval(()=>{if((new URLSearchParams(location.search).get('view')||'dashboard')==='installations'&&document.visibilityState==='visible'&&!document.getElementById('installation-detail-overlay'))load(new URLSearchParams(location.search).get('q')||'')},30000);
})();

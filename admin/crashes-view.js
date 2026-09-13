(() => {
  const content = document.getElementById('page-content');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium', timeStyle:'short'}) : '—';
  const ago = ts => { if (!ts) return '—'; const s=Math.max(0,Math.floor(Date.now()/1000)-Number(ts)); if(s<60)return `${s}s ago`; if(s<3600)return `${Math.floor(s/60)}m ago`; if(s<86400)return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
  const api = async (path, params={}) => { const q=new URLSearchParams(params); const r=await fetch(path+(q.toString()?`?${q}`:''),{credentials:'include',cache:'no-store'}); if(r.status===401){location.href='../admin-login.html';throw Error('Authentication required')} if(!r.ok)throw Error(`Request failed (${r.status})`); return r.json(); };

  function status(c){
    const s=String(c.severity||'error').toLowerCase();
    return `<span class="crash-severity ${s}"><i></i>${esc(s.toUpperCase())}</span>`;
  }
  function close(){document.getElementById('crash-detail-overlay')?.remove()}
  function exportCsv(rows){
    const h=['Crash ID','Installation ID','Version','Build','Platform','OS','Error Type','Severity','Message','Timestamp'];
    const csv=[h,...rows.map(r=>[r.crash_id,r.installation_id,r.app_version,r.build,r.platform,r.os_version,r.error_type,r.severity,r.message,date(r.timestamp)])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([csv.join('\n')],{type:'text/csv'}));a.download='melo-crashes.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }
  function detail(c){
    const overlay=document.createElement('div'); overlay.id='crash-detail-overlay'; overlay.className='crash-overlay';
    overlay.innerHTML=`<div class="crash-modal" role="dialog" aria-modal="true">
      <header class="crash-modal-head"><div><div class="crash-eyebrow">CRASH INVESTIGATION</div><div class="crash-title"><span class="crash-title-dot"></span><h2>${esc(c.error_type||'Unhandled crash')}</h2></div><p>${esc(c.crash_id)}</p></div><button class="crash-close" type="button">CLOSE</button></header>
      <div class="crash-modal-body">
        <div class="crash-hero-stats"><div><span>SEVERITY</span>${status(c)}</div><div><span>VERSION</span><strong>${esc(c.app_version||'—')}</strong><small>build ${esc(c.build||'—')}</small></div><div><span>OCCURRED</span><strong>${esc(ago(c.timestamp))}</strong><small>${esc(date(c.timestamp))}</small></div><div><span>PLATFORM</span><strong>${esc(c.platform||'—')}</strong><small>${esc(c.os_version||'—')}</small></div></div>
        <div class="crash-context"><div><span>INSTALLATION</span><code>${esc(c.installation_id||'—')}</code></div><div><span>EVENT ID</span><code>${esc(c.event_id||'—')}</code></div></div>
        <section class="crash-block"><div class="crash-block-head"><div><span>ERROR</span><h3>${esc(c.error_type||'Unhandled crash')}</h3></div></div><div class="crash-message">${esc(c.message||'No error message was supplied.')}</div></section>
        <section class="crash-block"><div class="crash-block-head"><div><span>DIAGNOSTICS</span><h3>Sanitized Stack Trace</h3></div><small>SAFE TO VIEW</small></div><pre class="crash-stack">${esc(c.stack_trace||'No stack trace was supplied.')}</pre></section>
        <footer class="crash-detail-foot"><span>MELO CRASH TELEMETRY</span><span>${esc(c.platform||'windows')} · schema ${esc(c.client_schema??'—')}</span></footer>
      </div></div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('.crash-close').onclick=close;
    overlay.addEventListener('click',e=>{if(e.target===overlay)close()});
    const key=e=>{if(e.key==='Escape'){close();document.removeEventListener('keydown',key)}}; document.addEventListener('keydown',key);
  }

  function render(rows, query=''){
    const now=Math.floor(Date.now()/1000);
    const today=rows.filter(r=>Number(r.timestamp)>=now-86400).length;
    const fatal=rows.filter(r=>String(r.severity||'error').toLowerCase()==='fatal').length;
    const installations=new Set(rows.map(r=>r.installation_id).filter(Boolean)).size;
    const body=rows.length?rows.map((r,i)=>`<tr class="data-row crash-row" data-index="${i}">
      <td><div class="crash-primary"><span class="crash-row-dot"></span><div><strong>${esc(r.error_type||'Unhandled crash')}</strong><small class="cell-sub mono">${esc(r.crash_id)}</small></div></div></td>
      <td class="mono">${esc(r.app_version||'—')}<small class="cell-sub">${esc(r.build||'—')}</small></td>
      <td class="mono">${esc(r.platform||'—')}<small class="cell-sub">${esc(r.os_version||'—')}</small></td>
      <td>${status(r)}</td>
      <td class="mono">${esc(ago(r.timestamp))}<small class="cell-sub">${esc(date(r.timestamp))}</small></td>
      <td class="mono">${esc(r.installation_id||'—')}</td>
    </tr>`).join(''):`<tr><td colspan="6"><div class="crash-empty"><span>✓</span><div><strong>No crash reports</strong><p>The crash pipeline is quiet.</p></div></div></td></tr>`;
    content.innerHTML=`<section class="page crash-page"><div class="page-intro crash-intro"><div><div class="crash-kicker">MONITORING / DIAGNOSTICS</div><h2>Crash Investigation</h2><p>Sanitized crash telemetry from MELO clients. Select a report to inspect the failure context.</p></div><span class="crash-live"><i></i>LIVE PIPELINE</span></div>
      <div class="metrics crash-metrics"><article class="metric"><small>TOTAL REPORTS</small><strong>${rows.length}</strong><span class="delta">Retained crash records</span></article><article class="metric"><small>LAST 24 HOURS</small><strong>${today}</strong><span class="delta">Recent reports</span></article><article class="metric"><small>FATAL</small><strong>${fatal}</strong><span class="delta">Highest severity</span></article><article class="metric"><small>AFFECTED CLIENTS</small><strong>${installations}</strong><span class="delta">Distinct installations</span></article></div>
      <div class="toolbar crash-toolbar"><input id="crash-search" class="search" value="${esc(query)}" placeholder="Search error, installation, version, crash ID…"><button id="crash-search-btn" class="filter">SEARCH</button><button id="crash-export" class="filter">EXPORT CSV</button></div>
      <section class="panel crash-panel"><div class="panel-head"><div><h2>Crash Reports</h2></div><span>${rows.length} REPORT${rows.length===1?'':'S'} · LIVE D1</span></div><table class="data-table crash-table"><thead><tr><th>FAILURE</th><th>VERSION</th><th>PLATFORM / OS</th><th>SEVERITY</th><th>TIME</th><th>INSTALLATION</th></tr></thead><tbody>${body}</tbody></table></section>
      <div class="health-strip crash-strip"><span><strong>DIAGNOSTIC DATA.</strong> Stack traces are sanitized before storage and display.</span><span class="right">CLICK A REPORT TO INVESTIGATE</span></div></section>`;
    document.querySelectorAll('.crash-row').forEach(row=>row.addEventListener('click',()=>detail(rows[Number(row.dataset.index)])));
    const input=document.getElementById('crash-search'); document.getElementById('crash-search-btn').onclick=()=>load(input.value.trim()); input.onkeydown=e=>{if(e.key==='Enter')document.getElementById('crash-search-btn').click()};
    document.getElementById('crash-export').onclick=()=>exportCsv(rows);
  }
  async function load(query=''){
    try{const d=await api('/api/admin/crashes',{q:query});render(d.rows||[],query)}catch(e){content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load crashes</h2><p>${esc(e.message)}</p></div></section>`}
  }
  function maybe(){if((new URLSearchParams(location.search).get('view')||'dashboard')==='crashes')load(new URLSearchParams(location.search).get('q')||'')}
  document.querySelectorAll('.nav-item[data-view="crashes"]').forEach(a=>a.addEventListener('click',()=>setTimeout(maybe,350)));
  window.addEventListener('popstate',()=>setTimeout(maybe,350));
  setTimeout(maybe,600);
  setInterval(()=>{if((new URLSearchParams(location.search).get('view')||'dashboard')==='crashes'&&document.visibilityState==='visible'&&!document.getElementById('crash-detail-overlay'))load(new URLSearchParams(location.search).get('q')||'')},30000);
})();

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

  async function showDetail(row){
    const overlay=document.createElement('div');
    overlay.id='installation-detail-overlay';
    overlay.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.72);backdrop-filter:blur(8px);z-index:9999;display:flex;align-items:center;justify-content:center;padding:24px;';
    overlay.innerHTML=`<div role="dialog" aria-modal="true" style="width:min(980px,100%);max-height:90vh;overflow:auto;background:#0b0b0b;border:1px solid rgba(255,255,255,.14);box-shadow:0 30px 100px rgba(0,0,0,.65);padding:28px;color:#f5f5f5;"><div style="display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid rgba(255,255,255,.1);padding-bottom:18px;"><div><div style="font-size:11px;letter-spacing:.14em;opacity:.55;margin-bottom:8px;">INSTALLATION DETAIL</div><h2 style="margin:0;font-size:24px;">${esc(row.installation_id)}</h2></div><button id="installation-detail-close" class="filter" type="button">CLOSE</button></div><div id="installation-detail-body" style="padding-top:22px;"><div class="empty">Loading telemetry…</div></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('installation-detail-close').onclick=closeDetail;
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeDetail()});
    try{
      const d=await api('/api/admin/installation',{id:row.installation_id});
      const i=d.installation||row, events=d.events||[], crashes=d.crashes||[], t=d.telemetry;
      const eventRows=events.length?events.map(e=>`<div style="display:grid;grid-template-columns:130px 1fr auto;gap:12px;padding:12px 0;border-bottom:1px solid rgba(255,255,255,.07);align-items:center;"><span class="mono" style="opacity:.65;font-size:12px;">${esc(date(e.timestamp))}</span><div><strong style="font-size:13px;">${esc(e.event_type).toUpperCase()}</strong><small class="cell-sub">${esc(e.event_id)}</small></div><span style="font-size:11px;opacity:.55;">${esc(e.app_version)} · ${esc(e.build||'—')}</span></div>`).join(''):`<div class="empty">No telemetry events recorded.</div>`;
      const crashRows=crashes.length?crashes.map(c=>`<div style="padding:14px 0;border-bottom:1px solid rgba(255,255,255,.07);"><div style="display:flex;justify-content:space-between;gap:12px;"><strong>${esc(c.error_type||'Crash')}</strong><span style="font-size:11px;opacity:.55;">${esc(date(c.timestamp))}</span></div><small class="cell-sub">${esc(c.message||'No message')}</small></div>`).join(''):`<div class="empty">No crash reports for this installation.</div>`;
      document.getElementById('installation-detail-body').innerHTML=`<div class="metrics" style="margin-bottom:22px;"><article class="metric"><small>VERSION</small><strong style="font-size:18px;">${esc(i.app_version)}</strong><span class="delta">build ${esc(i.build||'—')}</span></article><article class="metric"><small>LAST SEEN</small><strong style="font-size:18px;">${esc(ago(i.last_seen))}</strong><span class="delta">${esc(date(i.last_seen))}</span></article><article class="metric"><small>EVENTS</small><strong>${events.length}</strong><span class="delta">Last 500 retained in view</span></article><article class="metric"><small>CRASHES</small><strong>${crashes.length}</strong><span class="delta">Last 100 retained in view</span></article></div><div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:1px;background:rgba(255,255,255,.08);margin-bottom:22px;"><div style="background:#0b0b0b;padding:16px;"><small style="opacity:.5;letter-spacing:.1em;">PLATFORM</small><div style="margin-top:7px;">${esc(i.platform)} · ${esc(i.os_version||'—')}</div></div><div style="background:#0b0b0b;padding:16px;"><small style="opacity:.5;letter-spacing:.1em;">CLIENT SCHEMA</small><div style="margin-top:7px;">${esc(i.client_schema??'—')}</div></div><div style="background:#0b0b0b;padding:16px;"><small style="opacity:.5;letter-spacing:.1em;">FIRST SEEN</small><div style="margin-top:7px;">${esc(date(i.first_seen))}</div></div><div style="background:#0b0b0b;padding:16px;"><small style="opacity:.5;letter-spacing:.1em;">TELEMETRY CREDENTIAL</small><div style="margin-top:7px;"><span class="status-text ${t?.active?'good':''}"><i></i>${t?(t.active?'ACTIVE':'REVOKED'):'NOT ISSUED'}</span>${t?.lastUsedAt?`<small class="cell-sub">Last used ${esc(ago(t.lastUsedAt))}</small>`:''}</div></div></div><section class="panel" style="margin-bottom:18px;"><div class="panel-head"><h2>Telemetry Timeline</h2><span>${events.length} EVENT${events.length===1?'':'S'}</span></div><div style="padding:0 18px;">${eventRows}</div></section><section class="panel"><div class="panel-head"><h2>Crash Reports</h2><span>${crashes.length}</span></div><div style="padding:0 18px;">${crashRows}</div></section>`;
    }catch(e){document.getElementById('installation-detail-body').innerHTML=`<div class="empty">Unable to load installation telemetry.<br><small>${esc(e.message)}</small></div>`}
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

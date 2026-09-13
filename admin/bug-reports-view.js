(() => {
  const content = document.getElementById('page-content');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '—';
  const ago = ts => { if (!ts) return '—'; const s=Math.max(0,Math.floor(Date.now()/1000)-Number(ts)); if(s<60)return `${s}s ago`; if(s<3600)return `${Math.floor(s/60)}m ago`; if(s<86400)return `${Math.floor(s/3600)}h ago`; return `${Math.floor(s/86400)}d ago`; };
  const api = async (path, options={}) => { const r=await fetch(path,{credentials:'include',cache:'no-store',...options}); if(r.status===401){location.href='../admin-login.html';throw Error('Authentication required')} if(!r.ok)throw Error(`Request failed (${r.status})`); return r.json(); };

  function statusClass(s){return String(s||'new').toLowerCase().replace(/[^a-z]/g,'')}
  function statusLabel(s){return String(s||'NEW').toUpperCase()}

  function metrics(rows){
    const today=Math.floor(Date.now()/1000)-86400;
    return `<div class="metrics bug-metrics"><article class="metric"><small>OPEN REPORTS</small><strong>${rows.filter(r=>!['resolved','wont_fix'].includes(r.status)).length}</strong><span class="delta">Needs attention</span></article><article class="metric"><small>NEW</small><strong>${rows.filter(r=>r.status==='new').length}</strong><span class="delta">Awaiting review</span></article><article class="metric"><small>LAST 24 HOURS</small><strong>${rows.filter(r=>Number(r.submitted_at)>=today).length}</strong><span class="delta">Recently submitted</span></article><article class="metric"><small>WITH PROOF</small><strong>${rows.filter(r=>Number(r.attachment_count)>0).length}</strong><span class="delta">Reports with attachments</span></article></div>`;
  }

  function render(rows, query=''){
    const body=rows.length?rows.map((r,i)=>`<tr class="data-row bug-report-row" data-index="${i}"><td><span class="bug-id">${esc(r.report_id)}</span><small class="cell-sub">${esc(ago(r.submitted_at))}</small></td><td><strong>${esc(r.error_title||'Manual bug report')}</strong><small class="cell-sub bug-preview">${esc(r.what_happened||'No description')}</small></td><td><span class="bug-status ${statusClass(r.status)}">${statusLabel(r.status)}</span></td><td><span class="mono">${esc(r.app_version||'—')}</span><small class="cell-sub">${esc(r.build||'—')}</small></td><td class="mono">${esc(r.platform||'—')}<small class="cell-sub">${esc(r.os_version||'—')}</small></td><td>${Number(r.attachment_count)>0?`<span class="proof-count">${Number(r.attachment_count)} IMAGE${Number(r.attachment_count)===1?'':'S'}</span>`:'<span class="muted">—</span>'}</td></tr>`).join(''):`<tr><td colspan="6"><div class="empty"><div class="empty-mark">○</div>No bug reports found.</div></td></tr>`;
    content.innerHTML=`<section class="page"><div class="page-intro bug-intro"><div><span class="eyebrow">USER FEEDBACK</span><h2>Bug Reports</h2><p>Manual reports submitted from MELO, kept separate from automatic crash telemetry.</p></div><div class="bug-intro-mark">REPORT<br>INBOX</div></div>${metrics(rows)}<div class="toolbar"><input id="bug-search" class="search" value="${esc(query)}" placeholder="Search report, installation, version, description…"><button id="bug-search-btn" class="filter">SEARCH</button><button id="bug-export-btn" class="filter">EXPORT CSV</button></div><section class="panel bug-panel"><div class="panel-head"><div><h2>Report Inbox</h2><small class="panel-subtitle">Human-submitted issues · operational review</small></div><span>${rows.length} REPORT${rows.length===1?'':'S'}</span></div><table class="data-table bug-table"><thead><tr><th>REPORT</th><th>WHAT HAPPENED</th><th>STATUS</th><th>VERSION</th><th>PLATFORM / OS</th><th>PROOF</th></tr></thead><tbody>${body}</tbody></table></section><div class="health-strip bug-strip"><span><strong>MANUAL REPORTS.</strong> User identity is not collected by this channel.</span><span class="right">CLICK A REPORT TO INVESTIGATE</span></div></section>`;
    document.querySelectorAll('.bug-report-row').forEach(row=>row.addEventListener('click',()=>showDetail(rows[Number(row.dataset.index)])));
    document.getElementById('bug-search-btn').onclick=()=>load(document.getElementById('bug-search').value.trim());
    document.getElementById('bug-search').onkeydown=e=>{if(e.key==='Enter')document.getElementById('bug-search-btn').click()};
    document.getElementById('bug-export-btn').onclick=()=>exportCsv(rows);
  }

  function exportCsv(rows){
    const headers=['Report ID','Status','Submitted','What Happened','How To Reproduce','Expected Result','Installation ID','Version','Build','Platform','OS','Proof Images'];
    const lines=[headers,...rows.map(r=>[r.report_id,r.status,date(r.submitted_at),r.what_happened,r.reproduction_steps,r.expected_result,r.installation_id,r.app_version,r.build,r.platform,r.os_version,r.attachment_count])].map(row=>row.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(','));
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv'}));a.download='melo-bug-reports.csv';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);
  }

  function closeDetail(){document.getElementById('bug-detail-overlay')?.remove()}
  function closeImagePreview(){document.getElementById('bug-image-preview')?.remove()}
  function previewImage(src, filename){
    const existing=document.getElementById('bug-image-preview');
    if(existing) existing.remove();
    const overlay=document.createElement('div');
    overlay.id='bug-image-preview';
    overlay.style.cssText='position:fixed;inset:0;z-index:10001;background:rgba(10,10,14,.86);display:flex;align-items:center;justify-content:center;padding:28px;cursor:zoom-out;';
    overlay.innerHTML=`<div style="max-width:96vw;max-height:94vh;display:flex;flex-direction:column;align-items:center;gap:10px;cursor:default"><img src="${esc(src)}" alt="${esc(filename)}" style="display:block;max-width:94vw;max-height:84vh;object-fit:contain;border-radius:10px;background:#111;box-shadow:0 18px 70px rgba(0,0,0,.45)"><div style="display:flex;align-items:center;gap:12px;color:#fff;font-size:12px"><strong>${esc(filename)}</strong><button id="bug-image-close" type="button" style="border:1px solid rgba(255,255,255,.35);background:rgba(255,255,255,.1);color:#fff;border-radius:7px;padding:6px 10px;cursor:pointer">CLOSE</button></div></div>`;
    document.body.appendChild(overlay);
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeImagePreview()});
    document.getElementById('bug-image-close').onclick=closeImagePreview;
    const onKey=e=>{if(e.key==='Escape'){closeImagePreview();document.removeEventListener('keydown',onKey)}};
    document.addEventListener('keydown',onKey);
  }

  async function showDetail(row){
    const overlay=document.createElement('div'); overlay.id='bug-detail-overlay'; overlay.className='bug-overlay';
    overlay.innerHTML=`<div class="bug-modal" role="dialog" aria-modal="true"><header class="bug-modal-head"><div><span class="eyebrow">BUG REPORT</span><h2>${esc(row.report_id)}</h2><div class="bug-modal-meta"><span>${esc(ago(row.submitted_at))}</span><span>·</span><span>${esc(row.app_version||'Unknown')} / ${esc(row.build||'—')}</span></div></div><div class="bug-modal-actions"><span class="bug-status ${statusClass(row.status)}" id="bug-detail-status">${statusLabel(row.status)}</span><button class="filter" id="bug-close" type="button">CLOSE</button></div></header><div id="bug-detail-body"><div class="bug-loading"><span></span><span></span><span></span></div></div></div>`;
    document.body.appendChild(overlay);
    document.getElementById('bug-close').onclick=closeDetail;
    overlay.addEventListener('click',e=>{if(e.target===overlay)closeDetail()});
    const escClose=e=>{if(e.key==='Escape'){closeDetail();document.removeEventListener('keydown',escClose)}}; document.addEventListener('keydown',escClose);
    try{
      const d=await api('/api/admin/bug-report?id='+encodeURIComponent(row.report_id));
      const r=d.report||row, files=d.attachments||[];
      const attachments=files.length?files.map(f=>{
        const imageUrl='/api/admin/bug-attachment?id='+encodeURIComponent(f.attachment_id);
        return `<div class="attachment-row" style="display:flex;align-items:center;gap:12px"><button type="button" class="bug-image-thumb" data-src="${esc(imageUrl)}" data-name="${esc(f.filename)}" style="width:76px;height:58px;padding:0;border:1px solid rgba(0,0,0,.12);border-radius:8px;overflow:hidden;background:#f3f1eb;cursor:zoom-in;flex:0 0 auto"><img src="${esc(imageUrl)}" alt="${esc(f.filename)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block"></button><div style="min-width:0;flex:1"><strong>${esc(f.filename)}</strong><small style="display:block">${esc(f.content_type||'image')} · ${Number(f.size_bytes||0)?(Number(f.size_bytes)/1048576).toFixed(2)+' MB':'size unknown'}</small></div><button type="button" class="filter bug-image-open" data-src="${esc(imageUrl)}" data-name="${esc(f.filename)}">OPEN</button><span class="attachment-lock">SECURE</span></div>`;
      }).join(''):`<div class="empty">No proof images attached.</div>`;
      document.getElementById('bug-detail-body').innerHTML=`<div class="bug-detail-top"><div class="bug-detail-callout"><span class="eyebrow">SUBMISSION</span><p>${esc(r.what_happened||'No description provided.')}</p></div><div class="bug-context"><div><small>INSTALLATION</small><code>${esc(r.installation_id||'Not linked')}</code></div><div><small>PLATFORM</small><strong>${esc(r.platform||'—')} · ${esc(r.os_version||'—')}</strong></div><div><small>CLIENT SCHEMA</small><strong>${esc(r.client_schema??'—')}</strong></div><div><small>SUBMITTED</small><strong>${esc(date(r.submitted_at))}</strong></div></div></div><div class="bug-sections"><section class="bug-section"><div class="section-label">HOW TO REPRODUCE</div><div class="bug-copy">${esc(r.reproduction_steps||'Not provided.')}</div></section><section class="bug-section"><div class="section-label">EXPECTED RESULT</div><div class="bug-copy">${esc(r.expected_result||'Not provided.')}</div></section><section class="bug-section"><div class="section-label">PROOF IMAGES <span>${files.length}</span></div><div class="attachment-list">${attachments}</div></section></div><footer class="bug-detail-footer"><div><span class="eyebrow">WORKFLOW</span><p>Move this report through the operational queue.</p></div><div class="status-actions"><button data-status="new" class="status-btn">NEW</button><button data-status="reviewing" class="status-btn">REVIEWING</button><button data-status="resolved" class="status-btn">RESOLVED</button><button data-status="wont_fix" class="status-btn">WON'T FIX</button></div></footer>`;
      document.querySelectorAll('.bug-image-thumb,.bug-image-open').forEach(b=>b.addEventListener('click',e=>{e.stopPropagation();previewImage(b.dataset.src,b.dataset.name)}));
      document.querySelectorAll('.status-btn').forEach(b=>{if(b.dataset.status===r.status)b.classList.add('selected');b.onclick=()=>updateStatus(r.report_id,b.dataset.status,b)});
    }catch(e){document.getElementById('bug-detail-body').innerHTML=`<div class="bug-error">Unable to load this report.<small>${esc(e.message)}</small></div>`}
  }

  async function updateStatus(id,status,button){
    document.querySelectorAll('.status-btn').forEach(b=>b.disabled=true);
    try{await api('/api/admin/bug-report',{method:'PATCH',headers:{'content-type':'application/json'},body:JSON.stringify({id,status})});document.querySelectorAll('.status-btn').forEach(b=>b.classList.remove('selected'));button.classList.add('selected');const badge=document.getElementById('bug-detail-status');badge.textContent=statusLabel(status);badge.className='bug-status '+statusClass(status)}catch(e){alert(e.message)}finally{document.querySelectorAll('.status-btn').forEach(b=>b.disabled=false)}
  }

  async function load(query=''){
    try{const d=await api('/api/admin/bug-reports?q='+encodeURIComponent(query));render(d.rows||[],query)}catch(e){content.innerHTML=`<section class="page"><div class="page-intro"><h2>Unable to load bug reports</h2><p>${esc(e.message)}</p></div></section>`}
  }
  function maybeEnhance(){if((new URLSearchParams(location.search).get('view')||'dashboard')==='bug-reports')load(new URLSearchParams(location.search).get('q')||'')}
  window.addEventListener('popstate',()=>setTimeout(maybeEnhance,350));
  document.querySelectorAll('.nav-item[data-view="bug-reports"]').forEach(a=>a.addEventListener('click',()=>setTimeout(maybeEnhance,350)));
  setTimeout(maybeEnhance,550);
  setInterval(()=>{if((new URLSearchParams(location.search).get('view')||'dashboard')==='bug-reports'&&document.visibilityState==='visible'&&!document.getElementById('bug-detail-overlay'))load(new URLSearchParams(location.search).get('q')||'')},30000);
})();

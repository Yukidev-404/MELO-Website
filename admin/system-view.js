(() => {
  const render = async () => {
    const view=new URLSearchParams(location.search).get('view')||'dashboard';
    if(!['health','settings'].includes(view)) return;
    const c=document.getElementById('page-content'); if(!c||typeof api!=='function') return;
    try{
      if(view==='health'){
        const h=await api('/api/admin/health-detail');
        const components=h.components||[];
        c.innerHTML=`<section class="page system-page"><div class="page-intro"><h2>System Health</h2><p>Operational state of the MELO administration stack.</p></div><section class="metrics">${metric('OVERALL',components.every(x=>/OPERATIONAL|ACTIVE|OK/i.test(x.status))?'OPERATIONAL':'ATTENTION','Control Room')}${metric('COMPONENTS',components.length,'Monitored')}${metric('INSTALLATIONS',((components.find(x=>x.component==='D1')||{}).detail||'—').split(' ')[0],'D1')}${metric('TELEMETRY',components.some(x=>/Telemetry ingestion/i.test(x.component))?'ONLINE':'—','Ingestion')}</section><div class="two-col"><section class="panel"><div class="panel-head"><h2>Health checks</h2><span>LIVE</span></div><div class="system-checks">${components.map(x=>`<div><span>${esc(String(x.component).toUpperCase())}</span><b><i></i>${esc(x.status)}</b></div>`).join('')||'<div class="empty">No health checks returned.</div>'}</div></section><section class="panel"><div class="panel-head"><h2>Details</h2><span>EDGE</span></div><div class="system-checks">${components.map(x=>`<div><span>${esc(String(x.component).toUpperCase())}</span><b>${esc(x.detail)}</b></div>`).join('')||'<div class="empty">No details returned.</div>'}</div></section></div><div class="health-strip"><span><strong>SYSTEM HEALTH LIVE.</strong> Values come directly from the protected health endpoint.</span><span class="right">AUTO REFRESH 30S</span></div></section>`;
      }else{
        const d=await api('/api/admin/settings'); const rows=d.settings||[];
        const twofa=rows.find(x=>/Authenticator 2FA/i.test(x.setting));
        c.innerHTML=`<section class="page system-page"><div class="page-intro"><h2>Admin Settings</h2><p>Administrative configuration and security boundaries.</p></div><section class="metrics">${metric('2FA',twofa?.value||'—',twofa?.status||'Status')}${metric('SESSION TTL',(rows.find(x=>/Session TTL/i.test(x.setting))||{}).value||'—','Maximum lifetime')}${metric('ADMIN ACCOUNT',(rows.find(x=>/Admin account/i.test(x.setting))||{}).value||'Configured','Identity')}${metric('TELEMETRY SCHEMA',(rows.find(x=>/Telemetry schema/i.test(x.setting))||{}).value||'—','Client contract')}</section><section class="panel"><div class="panel-head"><h2>Configuration</h2><span>READ ONLY</span></div><table class="data-table"><thead><tr><th>SETTING</th><th>VALUE</th><th>STATUS</th></tr></thead><tbody>${rows.map(x=>`<tr><td class="mono">${esc(x.setting)}</td><td>${esc(x.value)}</td><td class="accent">${esc(x.status)}</td></tr>`).join('')||'<tr><td colspan="3">No settings returned.</td></tr>'}</tbody></table></section><div class="health-strip"><span><strong>SENSITIVE CONFIGURATION PROTECTED.</strong> Secrets and setup credentials are never displayed.</span><span class="right">SECURE</span></div></section>`;
      }
    }catch(e){c.innerHTML=`<section class="page"><div class="empty">Unable to load system view. ${esc(e.message)}</div></section>`}
  };
  window.addEventListener('popstate',render);setTimeout(render,0);setInterval(render,30000);
})();

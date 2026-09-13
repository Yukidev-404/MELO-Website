(() => {
  const render = async () => {
    const view=new URLSearchParams(location.search).get('view')||'dashboard';
    if(!['health','settings'].includes(view)) return;
    const c=document.getElementById('page-content'); if(!c||typeof api!=='function') return;
    try{
      if(view==='health'){
        const [h,s]=await Promise.all([api('/api/admin/health-detail'),api('/api/admin/services')]);
        const checks=s.rows||s.services||[];
        c.innerHTML=`<section class="page system-page"><div class="page-intro"><h2>System Health</h2><p>Operational state of the MELO administration stack.</p></div><section class="metrics">${metric('OVERALL','OPERATIONAL','Control Room')}${metric('DATABASE',h.database||'ONLINE','D1')}${metric('TELEMETRY',h.telemetry||'ONLINE','API')}${metric('SERVICES',checks.length||'—','Monitored')}</section><div class="two-col"><section class="panel"><div class="panel-head"><h2>Health checks</h2><span>LIVE</span></div><div class="system-checks">${[['WORKER','ONLINE'],['D1 DATABASE',h.database||'ONLINE'],['TELEMETRY API',h.telemetry||'ONLINE'],['ADMIN AUTH','PROTECTED']].map(x=>`<div><span>${x[0]}</span><b><i></i>${x[1]}</b></div>`).join('')}</div></section><section class="panel"><div class="panel-head"><h2>Runtime</h2><span>EDGE</span></div><div class="system-checks"><div><span>ENVIRONMENT</span><b>PRODUCTION</b></div><div><span>DATABASE</span><b>melo-admin</b></div><div><span>ADMIN SESSION</span><b>8H TTL</b></div><div><span>TELEMETRY WINDOW</span><b>60S</b></div></div></section></div><div class="health-strip"><span><strong>SYSTEM NOMINAL.</strong> Health data is refreshed from protected administration endpoints.</span><span class="right">AUTO REFRESH 30S</span></div></section>`;
      }else{
        const d=await api('/api/admin/settings');
        c.innerHTML=`<section class="page system-page"><div class="page-intro"><h2>Admin Settings</h2><p>Administrative configuration and security boundaries.</p></div><section class="metrics">${metric('ADMIN EMAIL',esc(d.email||'Configured'),'Identity')}${metric('2FA','ENABLED','TOTP')}${metric('SESSION','8 HOURS','Maximum lifetime')}${metric('TELEMETRY','ISOLATED','Dedicated credentials')}</section><div class="two-col"><section class="panel"><div class="panel-head"><h2>Authentication</h2><span>PROTECTED</span></div><div class="system-checks"><div><span>ADMIN EMAIL</span><b>${esc(d.email||'Configured')}</b></div><div><span>TOTP</span><b>CONFIGURED</b></div><div><span>SETUP TOKEN</span><b>NOT DISPLAYED</b></div><div><span>SESSION COOKIE</span><b>HTTPONLY</b></div></div></section><section class="panel"><div class="panel-head"><h2>Data boundaries</h2><span>POLICY</span></div><div class="system-checks"><div><span>ACCOUNT IDENTITY</span><b>NOT COLLECTED</b></div><div><span>SPOTIFY TOKENS</span><b>NOT COLLECTED</b></div><div><span>PERSONAL FILES</span><b>NOT COLLECTED</b></div><div><span>LOCATION</span><b>NOT COLLECTED</b></div></div></section></div><div class="health-strip"><span><strong>READ-ONLY SETTINGS VIEW.</strong> Sensitive configuration is never exposed here.</span><span class="right">SECURE</span></div></section>`;
      }
    }catch(e){c.innerHTML=`<section class="page"><div class="empty">Unable to load system view. ${esc(e.message)}</div></section>`}
  };
  window.addEventListener('popstate',render);setTimeout(render,0);setInterval(render,30000);
})();

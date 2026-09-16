(()=>{
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const fmt=d=>{if(!d)return '—';try{return new Intl.DateTimeFormat(undefined,{year:'numeric',month:'short',day:'numeric'}).format(new Date(d))}catch{return d}};
  const size=n=>{n=Number(n||0);if(!n)return '';const u=['B','KB','MB','GB'];let i=0;while(n>=1024&&i<3){n/=1024;i++}return `${n.toFixed(i?1:0)} ${u[i]}`};
  const assetOf=r=>(r.assets||[]).find(a=>/\.(exe|msi|zip)$/i.test(a.name))||null;
  const render=async()=>{
    try{
      const res=await fetch('/api/releases?limit=10',{cache:'no-store'});if(!res.ok)throw 0;
      const data=await res.json();const releases=Array.isArray(data.releases)?data.releases:[];const latest=releases[0];
      const heroDownload=document.querySelector('.hero .download');
      const releaseDownload=document.querySelector('.release-main .download');
      const latestTitle=document.querySelector('.release-main h3');
      const latestText=document.querySelector('.release-main p');
      const version=document.querySelector('.release-main .version');
      const history=document.querySelector('.release-side .history');
      const note=document.querySelector('.note');
      const asset=latest&&assetOf(latest);
      if(latest&&asset){
        const url=`/download/latest?asset=${encodeURIComponent(asset.name)}`;
        [heroDownload,releaseDownload].forEach(a=>{if(a){a.href=url;a.removeAttribute('target');a.removeAttribute('rel')}});
        if(heroDownload)heroDownload.textContent=`DOWNLOAD ${latest.tag_name||latest.name||'LATEST'} ↗`;
        if(releaseDownload)releaseDownload.textContent=`DOWNLOAD ${asset.name.toUpperCase()} ↓`;
        if(latestTitle)latestTitle.textContent=latest.name||latest.tag_name||'MELO DESKTOP';
        if(latestText)latestText.innerHTML=`Published ${fmt(latest.published_at||latest.created_at)}${latest.body?`<br><br>${esc(latest.body).replace(/\n/g,'<br>')}`:''}`;
        if(version)version.innerHTML=`<span><strong>${esc(latest.tag_name||latest.name||'LATEST')}</strong><br>${esc(asset.name)}${asset.size?` · ${size(asset.size)}`:''}</span><span class="pill">LATEST</span>`;
        if(note)note.innerHTML=`<strong>WINDOWS DESKTOP</strong> &nbsp;•&nbsp; ${esc(asset.name)} · ${size(asset.size)} &nbsp;•&nbsp; ${fmt(latest.published_at||latest.created_at)}`;
      }else{
        [heroDownload,releaseDownload].forEach(a=>{if(a){a.removeAttribute('href');a.textContent='RELEASE COMING SOON'}});
        if(latestTitle)latestTitle.textContent='MELO DESKTOP';
        if(latestText)latestText.textContent='The first public Windows release will appear here automatically when you publish a GitHub Release.';
        if(version)version.innerHTML='<span><strong>NOT RELEASED</strong><br>Windows desktop build</span><span class="pill">SOON</span>';
        if(note)note.innerHTML='<strong>WINDOWS DESKTOP</strong> &nbsp;•&nbsp; the release desk is waiting for the first public release.';
      }
      if(history){
        const old=releases.slice(1);history.innerHTML=old.length?old.map(r=>{const a=assetOf(r);const u=a?`/download/release/${encodeURIComponent(r.id)}?asset=${encodeURIComponent(a.name)}`:'';return `<li><span><b>${esc(r.name||r.tag_name||'MELO Desktop')}</b><br>${fmt(r.published_at||r.created_at)}${a?` · ${size(a.size)}`:''}</span><span>${u?`<a href="${u}">DOWNLOAD ↓</a>`:'—'}</span></li>`}).join(''):'<li><span><b>No previous releases yet.</b><br>New versions will appear here automatically.</span><span>SOON</span></li>';
      }
      document.querySelectorAll('.release-side a').forEach(a=>a.addEventListener('mouseenter',()=>{}));
    }catch(e){console.warn('MELO release desk unavailable',e)}
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
})();

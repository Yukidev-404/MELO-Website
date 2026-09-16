(()=>{
  const PROXY='https://wsrv.nl/?url=';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
  const proxy=u=>/^https?:\/\//i.test(u)?PROXY+encodeURIComponent(u)+'&w=1600&h=900&fit=contain&q=92&we=1':'';
  const domain=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
  const sources=(raw,station)=>{
    const out=[]; const add=u=>{if(!u)return;const s=String(u);const p=proxy(s);if(p)out.push(p);if(/^https:\/\//i.test(s))out.push(s)};
    add(raw);
    const host=domain(station?.homepage||station?.url_resolved||raw);
    if(host){add(`https://${host}/favicon.ico`);add(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`);add(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)}
    return [...new Set(out.filter(Boolean))];
  };
  const process=img=>{
    if(!(img instanceof HTMLImageElement)||img.dataset.meloArtProcessed)return;
    const cover=img.closest('.radio-discovery .station-cover');if(!cover)return;
    img.dataset.meloArtProcessed='1';
    const card=img.closest('.station');
    const title=card?.querySelector('.station-title')?.textContent||img.alt||'MELO';
    const raw=img.currentSrc||img.src;
    const fallback=document.createElement('span');fallback.className='station-fallback';fallback.textContent=initials(title);
    cover.replaceChildren(fallback);cover.classList.remove('has-art');
    const list=sources(raw,null);
    const next=()=>{const src=list.shift();if(!src)return;const probe=new Image();probe.decoding='async';probe.onload=()=>{const live=new Image();live.alt='';live.decoding='async';live.loading='eager';live.fetchPriority='high';live.src=src;cover.replaceChildren(live);cover.classList.add('has-art')};probe.onerror=next;probe.src=src};
    next();
  };
  const scan=root=>(root?.querySelectorAll?root.querySelectorAll('.radio-discovery .station-cover img').forEach(process):null);
  const style=document.createElement('style');style.textContent='.radio-discovery .station-cover{position:relative;overflow:hidden}.radio-discovery .station-cover .station-fallback{position:relative;z-index:1;display:flex;width:100%;height:100%;align-items:center;justify-content:center;font:700 28px "Space Grotesk",sans-serif;letter-spacing:-.05em;color:var(--ink,#171414)}.radio-discovery .station-cover.has-art .station-fallback{display:none}.radio-discovery .station-cover.has-art img{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;object-position:center;display:block}';document.head.appendChild(style);
  const start=()=>{scan(document);new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){process(n);scan(n)}}))).observe(document.body,{subtree:true,childList:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

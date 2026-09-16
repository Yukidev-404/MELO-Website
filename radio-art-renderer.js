(()=>{
  const PROXY='https://wsrv.nl/?url=';
  const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
  const proxy=u=>/^https?:\/\//i.test(u)?PROXY+encodeURIComponent(u)+'&w=640&h=360&fit=cover':'';
  const domain=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
  const add=(out,u)=>{
    if(!u)return;
    const s=String(u);
    if(/^https:\/\//i.test(s))out.push(s);
    const p=proxy(s);if(p)out.push(p);
  };
  const sourcesFor=(raw,hostHint)=>{
    const out=[];
    try{JSON.parse(raw||'[]').forEach(u=>add(out,u))}catch{}
    if(hostHint){
      add(out,`https://${hostHint}/favicon.ico`);
      add(out,`https://www.google.com/s2/favicons?domain=${encodeURIComponent(hostHint)}&sz=256`);
      add(out,`https://icons.duckduckgo.com/ip3/${encodeURIComponent(hostHint)}.ico`);
    }
    return [...new Set(out)];
  };
  const load=(holder,sources,title)=>{
    if(!holder||holder.dataset.artRendererBound)return;
    holder.dataset.artRendererBound='1';
    const fallback=document.createElement('span');
    fallback.className='station-fallback';
    fallback.textContent=initials(title||holder.closest('.station')?.querySelector('.station-title')?.textContent||'MELO');
    holder.replaceChildren(fallback);
    const list=[...sources];
    const next=()=>{
      const src=list.shift();
      if(!src)return;
      const probe=new Image();
      probe.decoding='async';
      probe.onload=()=>{
        if(!holder.isConnected)return;
        const img=new Image();
        img.alt='';
        img.decoding='async';
        img.loading='lazy';
        img.src=src;
        holder.replaceChildren(img);
        holder.classList.add('has-art');
      };
      probe.onerror=next;
      probe.src=src;
    };
    next();
  };
  const protectRaw=img=>{
    if(!(img instanceof HTMLImageElement)||img.dataset.artRendererRaw)return;
    const holder=img.closest('.station-cover');
    if(!holder)return;
    img.dataset.artRendererRaw='1';
    const src=img.currentSrc||img.src;
    const title=holder.closest('.station')?.querySelector('.station-title')?.textContent||img.alt||'MELO';
    const fallback=document.createElement('span');
    fallback.className='station-fallback';
    fallback.textContent=initials(title);
    img.replaceWith(fallback);
    load(holder,src?[proxy(src),src]:[],title);
  };
  const scan=root=>{
    if(!root?.querySelectorAll)return;
    root.querySelectorAll('.station-art[data-art-sources]').forEach(box=>{
      const host=domain(box.closest('.station')?.dataset.homepage||'');
      load(box,sourcesFor(box.dataset.artSources,host),box.closest('.station')?.querySelector('.station-title')?.textContent||'MELO');
    });
    root.querySelectorAll('.station-cover img').forEach(protectRaw);
  };
  const style=document.createElement('style');
  style.textContent='.station-cover{position:relative}.station-cover .station-fallback{position:relative;z-index:1;display:flex;width:100%;height:100%;align-items:center;justify-content:center;font:700 28px "Space Grotesk",sans-serif;letter-spacing:-.05em;color:var(--ink,#171414)}.station-cover.has-art .station-fallback{display:none}.station-cover .station-art.has-art img{width:100%;height:100%;object-fit:cover;display:block}.station-cover.has-art .station-fallback{display:none}';
  document.head.appendChild(style);
  const start=()=>{
    scan(document);
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(document.body,{subtree:true,childList:true});
  };
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

(()=>{
  const PROXY='https://wsrv.nl/?url=';
  const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
  const proxy=u=>/^https?:\/\//i.test(u)?PROXY+encodeURIComponent(u)+'&w=1600&h=900&fit=contain&q=92&we=1':'';
  const add=(out,u)=>{if(!u)return;const s=String(u);const p=proxy(s);if(p)out.push(p);if(/^https:\/\//i.test(s))out.push(s)};
  const load=(holder,sources,title)=>{
    if(!holder||holder.dataset.artRendererBound)return;
    holder.dataset.artRendererBound='1';
    const fallback=document.createElement('span');
    fallback.className='station-fallback';
    fallback.textContent=initials(title||holder.closest('.station')?.querySelector('.station-title')?.textContent||'MELO');
    holder.replaceChildren(fallback);
    const list=[...sources];
    const next=()=>{const src=list.shift();if(!src)return;const probe=new Image();probe.decoding='async';probe.onload=()=>{if(!holder.isConnected)return;const img=new Image();img.alt='';img.decoding='async';img.loading='eager';img.fetchPriority='high';img.src=src;holder.replaceChildren(img);holder.classList.add('has-art')};probe.onerror=next;probe.src=src};
    next();
  };
  const protectRaw=img=>{
    if(!(img instanceof HTMLImageElement)||img.dataset.artRendererRaw)return;
    const holder=img.closest('.station-cover');if(!holder)return;
    img.dataset.artRendererRaw='1';
    const src=img.currentSrc||img.src;
    const title=holder.closest('.station')?.querySelector('.station-title')?.textContent||img.alt||'MELO';
    const fallback=document.createElement('span');fallback.className='station-fallback';fallback.textContent=initials(title);img.replaceWith(fallback);
    load(holder,src?[proxy(src),src]:[],title);
  };
  const scan=root=>{if(!root?.querySelectorAll)return;root.querySelectorAll('.station-cover img').forEach(protectRaw)};
  const style=document.createElement('style');
  style.textContent='.station-cover{position:relative;overflow:hidden}.station-cover .station-fallback{position:relative;z-index:1;display:flex;width:100%;height:100%;align-items:center;justify-content:center;font:700 28px "Space Grotesk",sans-serif;letter-spacing:-.05em;color:var(--ink,#171414)}.station-cover.has-art .station-fallback{display:none}.station-cover img{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;display:block!important;object-fit:contain!important;object-position:center!important;image-rendering:auto!important}';
  document.head.appendChild(style);
  const start=()=>{scan(document);new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1)scan(n)}))).observe(document.body,{subtree:true,childList:true})};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

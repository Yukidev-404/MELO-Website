(()=>{
const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const protect=img=>{
  if(!(img instanceof HTMLImageElement)||img.dataset.discoveryArtFixed)return;
  const holder=img.closest('.station-cover');
  if(!holder)return;
  img.dataset.discoveryArtFixed='1';
  const src=img.currentSrc||img.src;
  if(!src)return;
  const title=holder.closest('.station')?.querySelector('.station-title')?.textContent||img.alt||'MELO';
  const fallback=document.createElement('span');
  fallback.className='station-fallback';
  fallback.textContent=initials(title);
  img.replaceWith(fallback);
  const probe=new Image();
  probe.decoding='async';
  probe.onload=()=>{
    if(!holder.isConnected)return;
    const live=new Image();
    live.alt='';
    live.decoding='async';
    live.loading='lazy';
    live.src=src;
    holder.replaceChildren(live);
    holder.classList.add('has-art');
  };
  probe.onerror=()=>{};
  probe.src=src;
};
const scan=root=>(root.querySelectorAll?root.querySelectorAll('.station-cover img'):[]).forEach(protect);
const style=document.createElement('style');
style.textContent='.station-cover{position:relative}.station-cover .station-fallback{position:relative;z-index:1;display:flex;width:100%;height:100%;align-items:center;justify-content:center;font:700 28px "Space Grotesk",sans-serif;letter-spacing:-.05em;color:var(--ink,#171414)}.station-cover.has-art .station-fallback{display:none}';
document.head.appendChild(style);
const start=()=>{scan(document);new MutationObserver(mutations=>mutations.forEach(m=>m.addedNodes.forEach(n=>{if(n.nodeType===1){if(n.matches?.('.station-cover img'))protect(n);scan(n)}}))).observe(document.body,{subtree:true,childList:true})};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();

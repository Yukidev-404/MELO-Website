(()=>{
const PROXY='https://wsrv.nl/?url=';
const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
const proxy=u=>/^https?:\/\//i.test(String(u||''))?`${PROXY}${encodeURIComponent(u)}&w=1600&h=900&fit=contain&output=webp&q=92`:'';
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
const sourcesFor=(raw,name)=>{
 let list=[];try{list=JSON.parse(raw||'[]')}catch{}
 const out=[];
 const add=u=>{if(!u)return;const s=String(u);if(/^https:\/\//i.test(s))out.push(s);const p=proxy(s);if(p)out.push(p)};
 list.forEach(add);
 const host=hostOf(list[0]);
 if(host){add(`https://${host}/favicon.ico`);out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`);out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)}
 return [...new Set(out)];
};
const style=()=>{if(document.getElementById('melo-art-final-style'))return;const s=document.createElement('style');s.id='melo-art-final-style';s.textContent=`.station-cover{position:relative;overflow:hidden}.station-cover .station-fallback{position:relative;z-index:1;font:700 24px/1 'Space Grotesk',sans-serif;letter-spacing:-.06em;color:var(--ink)}.station-cover .station-art{position:absolute;inset:0;z-index:3;display:block}.station-cover .station-art img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}.station-cover .station-art.loaded{background:var(--paper2)}.station-cover .station-art.loaded~.station-fallback{visibility:hidden}.station-cover>img{position:absolute!important;inset:0;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;z-index:3}`;document.head.appendChild(s)};
const load=(box,sources)=>{if(!box||box.dataset.artFinal==='1')return;box.dataset.artFinal='1';let i=0;const next=()=>{if(i>=sources.length)return;const src=sources[i++],img=new Image();img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{box.replaceChildren(img);box.classList.add('loaded')};img.onerror=next;img.src=src};next()};
const process=()=>{
 style();
 document.querySelectorAll('.station-art[data-art-sources]').forEach(box=>{let srcs=sourcesFor(box.dataset.artSources,'');load(box,srcs)});
 document.querySelectorAll('.station-cover>img').forEach(img=>{
  if(img.dataset.artFinal==='1')return;
  img.dataset.artFinal='1';
  const src=img.currentSrc||img.src;
  const box=img.parentElement;
  const name=box?.parentElement?.querySelector('.station-title')?.textContent||'MELO';
  const fallback=document.createElement('span');fallback.className='station-fallback';fallback.textContent=initials(name);
  img.remove();if(box&&!box.querySelector('.station-fallback'))box.prepend(fallback);
  const list=[src,proxy(src)];
  const host=hostOf(src);if(host){list.push(`https://${host}/favicon.ico`,proxy(`https://${host}/favicon.ico`),`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`,`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`)}
  const holder=document.createElement('span');holder.className='station-art';box.appendChild(holder);load(holder,[...new Set(list.filter(Boolean))]);
 });
};
new MutationObserver(process).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',process,{once:true});else process();
})();

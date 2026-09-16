(()=>{
const API_MIRRORS=['https://de1.api.radio-browser.info','https://nl1.api.radio-browser.info','https://at1.api.radio-browser.info'];
const PROXIES=[
 u=>`https://wsrv.nl/?url=${encodeURIComponent(u)}&w=1200&h=800&fit=contain&output=webp&q=92`,
 u=>`https://images.weserv.nl/?url=${encodeURIComponent(u)}&w=1200&h=800&fit=contain&output=webp&q=90`
];
const initials=name=>String(name||'MELO').replace(/[^\p{L}\p{N}\s]/gu,' ').trim().split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase()||'MELO';
const hostOf=u=>{try{return new URL(u).hostname.replace(/^www\./,'')}catch{return''}};
const unique=a=>[...new Set(a.filter(Boolean).map(String))];
const candidates=s=>{
 const out=[],add=u=>{if(!u)return;const x=String(u);out.push(x);if(/^https?:\/\//i.test(x))PROXIES.forEach(p=>out.push(p(x)))};
 add(s?.favicon);
 const hosts=unique([s?.homepage,s?.url_resolved,s?.favicon].map(hostOf));
 hosts.forEach(host=>{
  add(`https://${host}/favicon.ico`);
  out.push(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`);
  out.push(`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
 });
 return unique(out);
};
const style=()=>{if(document.getElementById('melo-art-final-style'))return;const s=document.createElement('style');s.id='melo-art-final-style';s.textContent=`
.station-cover{position:relative;overflow:hidden}
.station-cover .station-fallback{position:relative;z-index:1;font:700 24px/1 'Space Grotesk',sans-serif;letter-spacing:-.06em;color:var(--ink)}
.station-cover .station-art{position:absolute;inset:0;z-index:3;display:block}
.station-cover .station-art img{display:block;width:100%;height:100%;object-fit:contain;object-position:center}
.station-cover .station-art.loaded{background:var(--paper2)}
.station-cover .station-art.loaded + .station-fallback{visibility:hidden}
.station-cover .station-art.loaded ~ .station-fallback{visibility:hidden}
.station-cover>img{position:absolute!important;inset:0;width:100%!important;height:100%!important;object-fit:contain!important;object-position:center!important;z-index:3}
`;document.head.appendChild(s)};
const load=(box,sources)=>{
 if(!box||box.dataset.artFinal==='1')return Promise.resolve(false);
 box.dataset.artFinal='1';let i=0;
 return new Promise(resolve=>{const next=()=>{if(i>=sources.length){resolve(false);return}const src=sources[i++],img=new Image();img.decoding='async';img.referrerPolicy='no-referrer';img.onload=()=>{box.replaceChildren(img);box.classList.add('loaded');resolve(true)};img.onerror=next;img.src=src};next()});
};
const api=async path=>{for(const base of API_MIRRORS){try{const r=await fetch(base+path,{headers:{Accept:'application/json'}});if(r.ok)return await r.json()}catch{}}return null};
const stationForCard=async card=>{const id=card?.querySelector('[data-play]')?.dataset.play;if(!id)return null;const data=await api('/json/stations/byuuid/'+encodeURIComponent(id));return Array.isArray(data)?data[0]:data};
const process=async()=>{
 style();
 document.querySelectorAll('.station-cover').forEach(async box=>{
  if(box.dataset.artFinal==='1')return;
  const card=box.closest('.station'),holder=box.querySelector('.station-art[data-art-sources]');
  if(holder){let src=[];try{src=JSON.parse(holder.dataset.artSources||'[]')}catch{}if(await load(holder,unique(src)))return}
  const raw=box.querySelector(':scope>img');
  if(raw){
   const src=raw.currentSrc||raw.src,name=card?.querySelector('.station-title')?.textContent||'MELO';raw.remove();
   if(!box.querySelector('.station-fallback')){const f=document.createElement('span');f.className='station-fallback';f.textContent=initials(name);box.prepend(f)}
   const h=document.createElement('span');h.className='station-art';box.appendChild(h);
   const direct=[src];if(/^https?:\/\//i.test(src))PROXIES.forEach(p=>direct.push(p(src)));const host=hostOf(src);if(host)direct.push(`https://${host}/favicon.ico`,`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=256`,`https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`);
   if(await load(h,unique(direct)))return;
   const s=await stationForCard(card);if(s)await load(h,candidates(s));
  }
 });
};
new MutationObserver(()=>process()).observe(document.documentElement,{subtree:true,childList:true});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',process,{once:true});else process();
})();

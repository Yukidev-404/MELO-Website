(()=>{'use strict';
const API='https://melo-website.tajtaranga.workers.dev';
const $=id=>document.getElementById(id);
const state={authenticated:false,lastKey:'',lastPlaying:false,lastFavorite:'',timer:null};
const clean=v=>String(v??'').trim();
const parseTime=v=>{const m=clean(v).match(/^(\d+):(\d{1,2})$/);return m?(Number(m[1])*60+Number(m[2]))*1000:0};
const current=()=>{
  const name=clean($('trackTitle')?.textContent),artist=clean($('trackArtist')?.textContent),source=clean($('source')?.textContent).toUpperCase()||'LOCAL';
  if(!name||name==='NO TRACK PLAYING')return null;
  return {name,artist:artist||'Unknown Artist',id:`WEB:${source}:${name}\u0000${artist}`,duration_ms:parseTime($('duration')?.textContent)};
};
async function auth(){try{const r=await fetch(`${API}/api/auth/me`,{credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));state.authenticated=!!(r.ok&&d?.authenticated);return state.authenticated}catch{state.authenticated=false;return false}}
async function send(type,t){if(!state.authenticated||!t)return;const payload={event_id:crypto.randomUUID(),event_type:type,source:'web',played_at:Math.floor(Date.now()/1000),track:t};try{await fetch(`${API}/api/stats/event`,{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),keepalive:true})}catch{}}
function injectAccount(){const bar=document.querySelector('.titlebar');if(!bar||document.getElementById('meloAccountButton'))return;const b=document.createElement('button');b.id='meloAccountButton';b.type='button';b.textContent='ACCOUNT';b.title='MELO account';Object.assign(b.style,{marginLeft:'auto',marginRight:'10px',height:'34px',padding:'0 13px',border:'1px solid #c8c7c4',borderRadius:'17px',background:'#faf9f6',color:'#17171a',font:'10px Pixel, "Courier New", monospace',cursor:'pointer'});b.onclick=()=>{location.href=state.authenticated?'melo-card.html':'login.html?return=melo-web.html'};bar.insertBefore(b,bar.querySelector('.window-controls'));}
function updateAccount(){const b=$('meloAccountButton');if(!b)return;b.textContent=state.authenticated?'PLAYER CARD':'ACCOUNT';b.style.color=state.authenticated?'#ff47a3':'#17171a'}
async function tick(){const t=current(),playing=!!$('record')?.classList.contains('playing');if(t&&playing&&(!state.lastPlaying||state.lastKey!==t.id)){state.lastKey=t.id;await send('play',t)}state.lastPlaying=playing;const fav=$('favorite')?.querySelector('img')?.getAttribute('src')||'';if(t&&fav&&fav!==state.lastFavorite){const liked=/favorite_wave_active\.png(?:\?|$)/.test(fav);if(state.lastFavorite)await send(liked?'favorite':'unfavorite',t);state.lastFavorite=fav}}
async function start(){injectAccount();await auth();updateAccount();await tick();state.timer=setInterval(tick,1000);window.addEventListener('beforeunload',()=>{if(state.timer)clearInterval(state.timer)})}
start();
})();

(()=>{
const audio=document.getElementById('audio');
const panel=document.getElementById('playerPanel');
const nowName=document.getElementById('nowName');
const nowMeta=document.getElementById('nowMeta');
const playBtn=document.getElementById('playBtn');
if(!audio||!panel)return;

/* MELO Radio dock */
const dock=document.createElement('aside');
dock.className='radio-dock';
dock.innerHTML=`<div class="radio-dock-art" id="dockArt">MELO</div><div class="radio-dock-copy"><small id="dockStatus">READY</small><b id="dockName">Nothing tuned in.</b><span id="dockMeta">Choose a station to start listening.</span></div><button id="dockPlay" aria-label="Play or pause radio">▶</button><button id="dockTimer" class="dock-timer" aria-label="Sleep timer">SLEEP</button>`;
document.body.appendChild(dock);
const dockName=document.getElementById('dockName');
const dockMeta=document.getElementById('dockMeta');
const dockStatus=document.getElementById('dockStatus');
const dockArt=document.getElementById('dockArt');
const dockPlay=document.getElementById('dockPlay');
const dockTimer=document.getElementById('dockTimer');

dockPlay.onclick=()=>playBtn.click();
const syncDock=()=>{
  const active=nowName.textContent!=='Nothing tuned in.'&&nowName.textContent!=='Live radio';
  dockName.textContent=nowName.textContent;
  dockMeta.textContent=nowMeta.textContent;
  dockStatus.textContent=audio.error?'OFFLINE':audio.paused?(active?'PAUSED':'READY'):'LIVE';
  dockPlay.textContent=audio.paused?'▶':'❚❚';
  dock.classList.toggle('playing',!audio.paused);
  const img=document.querySelector('#nowArt img');
  dockArt.innerHTML=img?`<img src="${img.src}" alt="">`:'MELO';
};
['play','pause','error','loadstart','waiting','playing'].forEach(e=>audio.addEventListener(e,syncDock));
const observer=new MutationObserver(syncDock);
observer.observe(nowName,{childList:true,characterData:true,subtree:true});
observer.observe(nowMeta,{childList:true,characterData:true,subtree:true});

/* Sleep timer */
const timerMenu=document.createElement('div');
timerMenu.className='sleep-menu';
timerMenu.innerHTML=`<div class="sleep-title">SLEEP TIMER</div><button data-min="0">OFF</button><button data-min="15">15 MIN</button><button data-min="30">30 MIN</button><button data-min="45">45 MIN</button><button data-min="60">60 MIN</button><div class="sleep-count" id="sleepCount"></div>`;
dock.appendChild(timerMenu);
const sleepCount=document.getElementById('sleepCount');
let sleepEnd=0,sleepInterval=null;
function stopTimer(){sleepEnd=0;if(sleepInterval)clearInterval(sleepInterval);sleepInterval=null;sleepCount.textContent='';dockTimer.textContent='SLEEP';}
function startTimer(minutes){if(!minutes){stopTimer();return}sleepEnd=Date.now()+minutes*60000;dockTimer.textContent=`${minutes}M`;if(sleepInterval)clearInterval(sleepInterval);sleepInterval=setInterval(()=>{const left=Math.max(0,sleepEnd-Date.now());if(!left){clearInterval(sleepInterval);sleepInterval=null;audio.pause();sleepEnd=0;dockTimer.textContent='SLEEP';sleepCount.textContent='Playback stopped.';setTimeout(()=>sleepCount.textContent='',3500);syncDock();return}const sec=Math.ceil(left/1000);sleepCount.textContent=`Stops in ${Math.floor(sec/60)}:${String(sec%60).padStart(2,'0')}`;},500);}
dockTimer.onclick=()=>timerMenu.classList.toggle('open');timerMenu.querySelectorAll('[data-min]').forEach(b=>b.onclick=()=>{startTimer(Number(b.dataset.min));timerMenu.classList.remove('open')});document.addEventListener('click',e=>{if(!dock.contains(e.target))timerMenu.classList.remove('open')});

/* Keep the player docked only after the main player leaves the viewport. */
const io=new IntersectionObserver(entries=>dock.classList.toggle('visible',!entries[0].isIntersecting),{threshold:0});io.observe(panel);
syncDock();
})();

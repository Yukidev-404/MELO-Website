(() => {
  const loading=document.getElementById('loadingScreen'), loadingFill=document.getElementById('loadingFill'), loadingPercent=document.getElementById('loadingPercent'), loadingLabel=document.getElementById('loadingLabel');
  const loadingBar=loading?.querySelector('.loading-bar');
  const boot=document.getElementById('boot'), inner=document.querySelector('.boot-inner'), entry=document.getElementById('enter'), map=document.getElementById('map'), player=document.getElementById('player'), play=document.getElementById('play'), bar=document.querySelector('.bar'), title=document.querySelector('.song'), artist=document.querySelector('.artist'), rooms=[...document.querySelectorAll('.room')];
  const navCards=[...document.querySelectorAll('.home-card')];
  let playing=false, entering=false, hoverPlayed=false, audioUnlocked=false, keyboardCard=null;
  const hoverSfx=new Audio('assets/melo-entry-hover.mp3?v=20260915-2'), clickSfx=new Audio('assets/melo-entry-click.mp3?v=20260915-2');
  const ambientBgm=new Audio('assets/melo-bgm.mp3');
  ambientBgm.loop=true; ambientBgm.preload='auto'; ambientBgm.volume=.18;
  hoverSfx.preload='auto'; clickSfx.preload='auto'; hoverSfx.volume=1; clickSfx.volume=.65;
  function playSfx(a){try{a.currentTime=0;const p=a.play();if(p?.catch)p.catch(()=>{})}catch{}}
  function unlockHoverAudio(){if(audioUnlocked)return;try{hoverSfx.muted=true;const p=hoverSfx.play();if(p?.then)p.then(()=>{hoverSfx.pause();hoverSfx.currentTime=0;hoverSfx.muted=false;audioUnlocked=true}).catch(()=>{hoverSfx.muted=false})}catch{hoverSfx.muted=false}}
  function startAmbient(){try{const p=ambientBgm.play();if(p?.then)p.then(()=>{playing=true;updatePlayButton()}).catch(()=>{})}catch{}}
  function stopAmbient(){ambientBgm.pause();playing=false;updatePlayButton()}
  function startLoading(){
    if(!loading)return;const start=performance.now();
    function tick(now){const progress=Math.min(100,((now-start)/2300)*100);if(loadingFill)loadingFill.style.width=progress+'%';if(loadingPercent)loadingPercent.textContent=Math.floor(progress)+'%';if(loadingBar)loadingBar.setAttribute('aria-valuenow',String(Math.floor(progress)));if(progress<100)requestAnimationFrame(tick)}
    requestAnimationFrame(tick);setTimeout(()=>loading?.classList.add('ring-on'),300);setTimeout(()=>loading?.classList.add('accent'),1000);setTimeout(()=>{if(loadingLabel)loadingLabel.textContent='loading melo...'},1750);setTimeout(()=>{loading?.classList.add('ready');if(loadingLabel)loadingLabel.textContent='ready ♡';if(loadingFill)loadingFill.style.width='100%';if(loadingPercent)loadingPercent.textContent='100%';if(loadingBar)loadingBar.setAttribute('aria-valuenow','100')},2080);setTimeout(()=>loading?.classList.add('done'),2300);
  }
  function enter(){if(entering||boot.classList.contains('hide'))return;entering=true;unlockHoverAudio();inner?.classList.remove('rim-hover');inner?.classList.add('rim-active');playSfx(clickSfx);setTimeout(()=>{boot.classList.add('hide');map.classList.add('ready');startAmbient()},720)}
  function openRoom(name){rooms.forEach(r=>r.classList.toggle('open',r.dataset.room===name));keyboardCard=null}
  function updatePlayButton(){if(play)play.textContent=playing?'❚❚':'▶';player?.classList.toggle('playing',playing)}
  function togglePlayback(){if(ambientBgm.paused)startAmbient();else stopAmbient()}
  function setKeyboardCard(card){
    if(!card)return;
    keyboardCard=card;
    navCards.forEach(c=>c.classList.remove('keyboard-focus'));
    card.classList.add('keyboard-focus');
    card.focus({preventScroll:true});
  }
  function nextCard(direction){
    if(!navCards.length)return;
    const current=keyboardCard||document.activeElement?.closest?.('.home-card')||navCards[0];
    if(!keyboardCard)setKeyboardCard(current);
    if(navCards.length===1)return;
    const cr=current.getBoundingClientRect();
    const cx=cr.left+cr.width/2, cy=cr.top+cr.height/2;
    const vectors={ArrowRight:[1,0],ArrowLeft:[-1,0],ArrowDown:[0,1],ArrowUp:[0,-1]};
    const [dx,dy]=vectors[direction];
    const candidates=navCards.filter(card=>card!==current).map(card=>{
      const r=card.getBoundingClientRect();
      const x=r.left+r.width/2-cx, y=r.top+r.height/2-cy;
      const distance=Math.hypot(x,y)||1;
      const forward=(x*dx+y*dy)/distance;
      const perpendicular=Math.abs(x*dy-y*dx)/distance;
      return {card,distance,forward,perpendicular};
    }).filter(item=>item.forward>.12);
    candidates.sort((a,b)=>{
      const scoreA=a.perpendicular*2.8+a.distance*.0015-a.forward*.45;
      const scoreB=b.perpendicular*2.8+b.distance*.0015-b.forward*.45;
      return scoreA-scoreB;
    });
    const fallback=navCards.filter(card=>card!==current).sort((a,b)=>{
      const ar=a.getBoundingClientRect(), br=b.getBoundingClientRect();
      return Math.hypot(ar.left+ar.width/2-cx,ar.top+ar.height/2-cy)-Math.hypot(br.left+br.width/2-cx,br.top+br.height/2-cy);
    })[0];
    setKeyboardCard((candidates[0]||{card:fallback}).card);
  }
  startLoading();
  entry?.addEventListener('mouseenter',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering&&audioUnlocked){hoverPlayed=true;playSfx(hoverSfx)}});
  entry?.addEventListener('mouseleave',()=>{if(!entering){inner?.classList.remove('rim-hover');hoverPlayed=false}});
  entry?.addEventListener('focus',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering&&audioUnlocked){hoverPlayed=true;playSfx(hoverSfx)}});
  entry?.addEventListener('blur',()=>{if(!entering)inner?.classList.remove('rim-hover')});
  entry?.addEventListener('pointerdown',()=>{unlockHoverAudio();inner?.classList.add('rim-active')});entry?.addEventListener('click',enter);
  navCards.forEach(card=>card.addEventListener('focus',()=>{keyboardCard=card;navCards.forEach(c=>{if(c!==card)c.classList.remove('keyboard-focus')});card.classList.add('keyboard-focus')}));
  navCards.forEach(card=>card.addEventListener('pointerenter',()=>{if(keyboardCard&&keyboardCard!==card){keyboardCard.classList.remove('keyboard-focus');keyboardCard=null}}));
  document.addEventListener('keydown',e=>{
    if(!boot.classList.contains('hide')){if(e.key==='Enter')enter();return}
    if(e.key==='Escape'){rooms.forEach(r=>r.classList.remove('open'));keyboardCard=null;navCards.forEach(c=>c.classList.remove('keyboard-focus'));return}
    if(rooms.some(r=>r.classList.contains('open')))return;
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){
      e.preventDefault();nextCard(e.key);return;
    }
    if(e.key===' '){e.preventDefault();togglePlayback()}
  });
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.open)));document.querySelectorAll('.room-close').forEach(b=>b.addEventListener('click',()=>b.closest('.room').classList.remove('open')));
  play?.addEventListener('click',e=>{e.stopPropagation();togglePlayback()});player?.addEventListener('click',e=>{if(e.target.closest('button'))return;togglePlayback()});
  bar?.addEventListener('click',e=>{const r=bar.getBoundingClientRect();bar.querySelector('i')?.style.setProperty('width',Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))+'%')});
  document.querySelectorAll('.room-row button').forEach(b=>b.addEventListener('click',()=>{b.textContent=b.textContent==='QUEUE'?'QUEUED ✓':'PLAYING ✓';b.style.background='var(--pink)';b.style.color='#fff'}));
  document.querySelectorAll('.theme').forEach(theme=>theme.addEventListener('click',()=>{document.querySelectorAll('.theme').forEach(x=>x.classList.remove('active'));theme.classList.add('active');if(theme.dataset.color)document.documentElement.style.setProperty('--pink',theme.dataset.color)}));
  document.getElementById('backHome')?.addEventListener('click',e=>{e.preventDefault();rooms.forEach(r=>r.classList.remove('open'))});document.querySelectorAll('.player-action').forEach(b=>b.addEventListener('click',()=>openRoom('library')));
})();

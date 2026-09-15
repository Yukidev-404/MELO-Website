(() => {
  const boot=document.getElementById('boot'), inner=document.querySelector('.boot-inner'), entry=document.getElementById('enter'), map=document.getElementById('map'), player=document.getElementById('player'), play=document.getElementById('play'), bar=document.querySelector('.bar'), title=document.querySelector('.song'), artist=document.querySelector('.artist'), rooms=[...document.querySelectorAll('.room')];
  let playing=false, track=0, entering=false, hoverPlayed=false;
  const tracks=[['Pleasure','Dylan Sinclair'],['Enough','Deukota'],['Get It Together','Télépomusik Lofi Flip']];
  const hoverSfx=new Audio('assets/melo-entry-hover.mp3?v=20260915-2');
  const clickSfx=new Audio('assets/melo-entry-click.mp3?v=20260915-2');
  hoverSfx.preload='auto';
  clickSfx.preload='auto';
  hoverSfx.volume=1.0;
  clickSfx.volume=.65;
  function playSfx(audio){
    try{audio.currentTime=0;const p=audio.play();if(p?.catch)p.catch(()=>{});}catch{}
  }
  function enter(){
    if(entering || boot.classList.contains('hide')) return;
    entering=true;
    inner?.classList.remove('rim-hover');
    inner?.classList.add('rim-active');
    playSfx(clickSfx);
    setTimeout(()=>{boot.classList.add('hide');map.classList.add('ready');},720);
  }
  function openRoom(name){rooms.forEach(r=>r.classList.toggle('open',r.dataset.room===name))}
  function setTrack(i){track=(i+tracks.length)%tracks.length;title.textContent=tracks[track][0];artist.textContent=tracks[track][1];playing=true;player.classList.add('playing');play.textContent='❚❚';}
  entry?.addEventListener('mouseenter',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering){hoverPlayed=true;playSfx(hoverSfx);}});
  entry?.addEventListener('mouseleave',()=>{if(!entering){inner?.classList.remove('rim-hover');hoverPlayed=false;}});
  entry?.addEventListener('focus',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering){hoverPlayed=true;playSfx(hoverSfx);}});
  entry?.addEventListener('blur',()=>{if(!entering) inner?.classList.remove('rim-hover')});
  entry?.addEventListener('pointerdown',()=>inner?.classList.add('rim-active'));
  entry?.addEventListener('click',enter);
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!boot.classList.contains('hide')) enter();
    if(e.key==='Escape')rooms.forEach(r=>r.classList.remove('open'));
    if(e.key==='ArrowRight')setTrack(track+1);
    if(e.key==='ArrowLeft')setTrack(track-1);
    if(e.key===' '&&boot.classList.contains('hide')){e.preventDefault();play?.click()}
  });
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.open)));
  document.querySelectorAll('.room-close').forEach(b=>b.addEventListener('click',()=>b.closest('.room').classList.remove('open')));
  play?.addEventListener('click',()=>{playing=!playing;player.classList.toggle('playing',playing);play.textContent=playing?'❚❚':'▶'});
  document.getElementById('nextTrack')?.addEventListener('click',()=>setTrack(track+1));
  document.getElementById('prevTrack')?.addEventListener('click',()=>setTrack(track-1));
  bar?.addEventListener('click',e=>{const r=bar.getBoundingClientRect();bar.querySelector('i').style.width=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))+'%'});
  document.querySelectorAll('[data-track-room]').forEach(b=>b.addEventListener('click',()=>{setTrack(Number(b.dataset.trackRoom));openRoom('library')}));
  document.querySelectorAll('.room-row button:not([data-track-room])').forEach(b=>b.addEventListener('click',()=>{b.textContent=b.textContent==='QUEUE'?'QUEUED ✓':'PLAYING ✓';b.style.background='var(--pink)';b.style.color='#fff'}));
  document.querySelectorAll('.theme').forEach(theme=>theme.addEventListener('click',()=>{document.querySelectorAll('.theme').forEach(x=>x.classList.remove('active'));theme.classList.add('active');if(theme.dataset.color)document.documentElement.style.setProperty('--pink',theme.dataset.color)}));
  document.getElementById('backHome')?.addEventListener('click',e=>{e.preventDefault();rooms.forEach(r=>r.classList.remove('open'));});
  document.querySelectorAll('.player-action').forEach(b=>b.addEventListener('click',()=>openRoom('library')));
})();

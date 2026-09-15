(() => {
  const boot=document.getElementById('boot'), map=document.getElementById('map'), player=document.getElementById('player'), play=document.getElementById('play'), bar=document.querySelector('.bar'), title=document.querySelector('.song'), artist=document.querySelector('.artist'), rooms=[...document.querySelectorAll('.room')];
  let playing=false, track=0;
  const tracks=[['Pleasure','Dylan Sinclair'],['Enough','Deukota'],['Get It Together','Télépomusik Lofi Flip']];
  function enter(){boot.classList.add('hide');map.classList.add('ready')}
  function openRoom(name){rooms.forEach(r=>r.classList.toggle('open',r.dataset.room===name))}
  function setTrack(i){track=(i+tracks.length)%tracks.length;title.textContent=tracks[track][0];artist.textContent=tracks[track][1];playing=true;player.classList.add('playing');play.textContent='❚❚';}
  document.getElementById('enter')?.addEventListener('click',enter);
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!boot.classList.contains('hide'))enter();if(e.key==='Escape')rooms.forEach(r=>r.classList.remove('open'));if(e.key==='ArrowRight')setTrack(track+1);if(e.key==='ArrowLeft')setTrack(track-1);if(e.key===' '&&boot.classList.contains('hide')){e.preventDefault();play?.click()}});
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

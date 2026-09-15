(() => {
  const boot=document.getElementById('boot');
  const map=document.getElementById('map');
  const player=document.getElementById('player');
  const play=document.getElementById('play');
  const bar=document.querySelector('.bar');
  const title=document.querySelector('.song');
  const artist=document.querySelector('.artist');
  const rooms=[...document.querySelectorAll('.room')];
  let playing=false;
  const tracks=[['Pleasure','Dylan Sinclair'],['Enough','Deukota'],['Get It Together','Télépomusik Lofi Flip']];
  let track=0;

  function enter(){boot.classList.add('hide');map.classList.add('ready');}
  document.getElementById('enter')?.addEventListener('click',enter);
  document.addEventListener('keydown',e=>{if(e.key==='Enter'&&!boot.classList.contains('hide'))enter();});

  function openRoom(name){rooms.forEach(r=>r.classList.toggle('open',r.dataset.room===name));}
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.open)));
  document.querySelectorAll('.room-close').forEach(b=>b.addEventListener('click',()=>b.closest('.room').classList.remove('open')));

  play?.addEventListener('click',()=>{
    playing=!playing;
    player.classList.toggle('playing',playing);
    play.textContent=playing?'❚❚':'▶';
  });
  document.getElementById('nextTrack')?.addEventListener('click',()=>{track=(track+1)%tracks.length;title.textContent=tracks[track][0];artist.textContent=tracks[track][1];playing=true;player.classList.add('playing');play.textContent='❚❚';});
  document.getElementById('prevTrack')?.addEventListener('click',()=>{track=(track-1+tracks.length)%tracks.length;title.textContent=tracks[track][0];artist.textContent=tracks[track][1];playing=true;player.classList.add('playing');play.textContent='❚❚';});
  bar?.addEventListener('click',e=>{const r=bar.getBoundingClientRect();const pct=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));bar.querySelector('i').style.width=pct+'%';});

  document.querySelectorAll('.theme').forEach(theme=>theme.addEventListener('click',()=>{
    document.querySelectorAll('.theme').forEach(x=>x.classList.remove('active'));theme.classList.add('active');
    const color=theme.dataset.color;if(color)document.documentElement.style.setProperty('--pink',color);
  }));

  document.getElementById('backHome')?.addEventListener('click',()=>{rooms.forEach(r=>r.classList.remove('open'));window.scrollTo(0,0);});
  document.querySelectorAll('.player-action').forEach(b=>b.addEventListener('click',()=>{if(b.dataset.action==='library')openRoom('library');}));
})();

(() => {
  const world=document.querySelector('.world');
  if(!world) return;

  // Custom MELO cursor on desktop.
  const cursor=document.createElement('div');
  cursor.className='melo-cursor';
  document.body.appendChild(cursor);
  let cx=-100,cy=-100,tx=-100,ty=-100;
  const desktop=matchMedia('(pointer:fine)').matches;
  if(desktop){
    addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY});
    const move=()=>{cx+=(tx-cx)*.22;cy+=(ty-cy)*.22;cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;requestAnimationFrame(move)};
    move();
    document.querySelectorAll('a,button,.room-card,.player').forEach(el=>{
      el.addEventListener('mouseenter',()=>cursor.classList.add('hover'));
      el.addEventListener('mouseleave',()=>cursor.classList.remove('hover'));
    });
    addEventListener('pointerdown',()=>cursor.classList.add('click'));
    addEventListener('pointerup',()=>cursor.classList.remove('click'));
  }

  // Ambient world details: deliberately sparse so the page stays calm.
  const ambient=document.createElement('div');
  ambient.className='ambient';
  ['♡','✦','·','✧','≋'].forEach(mark=>{const s=document.createElement('span');s.className='ambient-bit';s.textContent=mark;ambient.appendChild(s)});
  world.appendChild(ambient);

  // Small parallax on the main player while the pointer is over the world.
  const player=document.getElementById('player');
  const map=document.getElementById('map');
  if(desktop && player && map){
    map.addEventListener('pointermove',e=>{
      if(!map.classList.contains('ready')) return;
      const r=map.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      if(!player.matches(':hover')) player.style.transform=`translate(-50%,-45%) translate(${x*5}px,${y*4}px)`;
    });
    map.addEventListener('pointerleave',()=>{player.style.transform='translate(-50%,-45%)'});
  }

  // Give all interactive controls tactile click feedback without replacing existing logic.
  document.addEventListener('click',e=>{
    const el=e.target.closest('button,a');
    if(!el || el.closest('.loading-screen')) return;
    el.animate?.([{transform:'scale(.98)'},{transform:'scale(1)'}],{duration:130,easing:'ease-out'});
  },{passive:true});
})();

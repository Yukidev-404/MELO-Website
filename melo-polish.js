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

  // ROOM 07 — hydrate the Player Card from the signed-in MELO session.
  const API_BASE='https://melo-website.tajtaranga.workers.dev';
  const hydratePlayerCard=async()=>{
    const card=document.querySelector('.melo-player-card');
    if(!card)return;
    try{
      const response=await fetch(`${API_BASE}/api/auth/me`,{credentials:'include',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(!response.ok||!data.authenticated||!data.user)return;
      const user=data.user;
      const name=(user.display_name||user.email?.split('@')[0]||'MELO PLAYER').trim();
      const shortId=user.id?String(user.id).replace(/-/g,'').slice(0,8).toLowerCase():'';
      const avatar=card.querySelector('.pc-avatar img');
      const nameEl=card.querySelector('.pc-identity h3');
      const idEl=card.querySelector('.pc-identity p');
      const status=card.querySelector('.pc-status');
      const footLabel=card.querySelector('.pc-foot span');
      const footText=card.querySelector('.pc-foot b');
      const footLink=card.querySelector('.pc-foot a');
      if(nameEl)nameEl.textContent=name;
      if(idEl)idEl.textContent=shortId?`@melo-${shortId}`:'@melo-player';
      if(avatar&&user.avatar_url)avatar.src=user.avatar_url;
      if(avatar&&user.avatar_url)avatar.alt=`${name}'s MELO avatar`;
      if(status)status.innerHTML='<span></span> <span class="pc-connected-text">MELO ACCOUNT CONNECTED</span>';
      if(footLabel)footLabel.textContent='YOUR CARD';
      if(footText)footText.textContent='This card is connected to your MELO account →';
      if(footLink){footLink.textContent='SIGNED IN';footLink.removeAttribute('href');footLink.setAttribute('aria-label','Signed in to MELO');footLink.style.pointerEvents='none';}
      card.setAttribute('aria-label',`${name}'s MELO Player Card`);
    }catch(error){console.debug('Player Card session lookup failed',error);}
  };
  hydratePlayerCard();

  // Connected account status uses green, not the MELO pink accent.
  const connectedStyle=document.createElement('style');
  connectedStyle.textContent='.pc-status .pc-connected-text{color:#238636!important}.pc-status:has(.pc-connected-text){border-color:#238636!important}.pc-status:has(.pc-connected-text)>span:first-child{background:#238636!important;animation:pcPulse 1.5s ease-in-out infinite}';
  document.head.appendChild(connectedStyle);
})();

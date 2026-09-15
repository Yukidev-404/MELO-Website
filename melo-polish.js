(() => {
  const world=document.querySelector('.world');
  if(!world) return;

  const home=document.createElement('div');
  home.className='melo-home';
  home.innerHTML=`
    <header class="home-nav">
      <a class="home-brand" href="#top">MELO<span>♡</span></a>
      <nav><a href="#about">ABOUT</a><a href="#player-showcase">THE PLAYER</a><a href="#download">GET MELO</a></nav>
      <a class="home-account" href="login.html">ACCOUNT ↗</a>
    </header>
    <main>
      <section class="home-hero" id="top">
        <div class="hero-copy">
          <div class="home-kicker">A LITTLE MUSIC WORLD</div>
          <h1>MUSIC<br><em>FOR A</em><br>BETTER YOU.</h1>
          <p>MELO is a music player made to feel like a place — not another app you open and forget.</p>
          <div class="hero-actions"><a class="home-primary" href="#player-showcase">EXPLORE MELO →</a><a class="home-secondary" href="#about">WHAT IS THIS? ↓</a></div>
        </div>
        <div class="hero-art"><div class="hero-ring ring-a"></div><div class="hero-ring ring-b"></div><span class="hero-spark s1">✦</span><span class="hero-spark s2">♡</span><span class="hero-spark s3">✧</span><img src="assets/melo-cat.png" alt="MELO cat mascot"><div class="hero-stamp">メロ<br><small>PLAY SOMETHING</small></div></div>
        <div class="hero-ticker"><span>MELO / MUSIC / RECORDS / YOUR SPACE / 2026</span></div>
      </section>
      <section class="home-intro" id="about">
        <div class="section-label">001 / THE IDEA</div>
        <div class="intro-grid"><h2>YOUR MUSIC<br>DESERVES A<br><span>ROOM.</span></h2><div><p>Most music players are built like dashboards. MELO is built like a little world you can disappear into.</p><p>Keep your records close. Change the mood. Find something to listen to. Stay awhile.</p><a href="#player-showcase" class="text-link">SEE HOW IT WORKS ↗</a></div></div>
      </section>
      <section class="home-player" id="player-showcase">
        <div class="section-label">002 / INSIDE MELO</div>
        <div class="player-showcase-grid"><div class="showcase-copy"><div class="mini-label">CURRENTLY PLAYING</div><h2>PLEASURE</h2><p>Dylan Sinclair</p><div class="fake-controls"><span>01:42</span><div><i></i></div><span>03:55</span></div><div class="showcase-buttons"><button>◀</button><button class="big">▶</button><button>▶</button></div><span class="tiny-note">A player that feels like an object in your room.</span></div><div class="showcase-visual"><div class="record-shadow"></div><img src="assets/melo-banner.png" alt="MELO player artwork"><div class="record-disc"></div><span class="visual-note">LOCAL<br>/ READY</span></div></div>
      </section>
      <section class="home-features"><div class="section-label">003 / THE LITTLE THINGS</div><div class="feature-grid"><article><span>01</span><h3>YOUR LIBRARY.</h3><p>Keep your favorite records together and make listening feel personal.</p></article><article><span>02</span><h3>YOUR SPACE.</h3><p>Change the mood. Build a listening space that actually feels like yours.</p></article><article><span>03</span><h3>YOUR WORLD.</h3><p>Explore instead of scrolling through another endless catalogue.</p></article></div></section>
      <section class="home-download" id="download"><div class="download-cat"><img src="assets/melo-cat.png" alt="MELO mascot"></div><div><div class="section-label">004 / BRING IT HOME</div><h2>READY TO<br>MEET <span>MELO?</span></h2><p>Take your little listening room with you. MELO Desktop is currently available for Windows.</p><a class="home-primary" href="https://github.com/Yukidev-404/MELO-Website/releases" target="_blank" rel="noopener">GET MELO FOR WINDOWS ↗</a></div></section>
      <section class="home-enter"><div><small>ONE LAST THING</small><h2>THE WORLD<br>IS WAITING.</h2></div><a class="home-enter-button" href="#" data-enter-world>ENTER MELO WORLD <b>→</b></a></section>
    </main>
    <footer class="home-footer"><span>MELO © 2026</span><span>MADE FOR BETTER LISTENING ♡</span><a href="login.html">ACCOUNT ↗</a></footer>`;
  world.prepend(home);

  const launch=()=>{home.classList.add('leaving');setTimeout(()=>{home.style.display='none';document.documentElement.classList.add('melo-world-mode');document.body.style.overflow='hidden';const boot=document.getElementById('boot'),map=document.getElementById('map');boot?.classList.remove('hide');map?.classList.remove('ready');},520)};
  home.querySelector('[data-enter-world]')?.addEventListener('click',e=>{e.preventDefault();launch()});

  const cursor=document.createElement('div');cursor.className='melo-cursor';document.body.appendChild(cursor);
  let cx=-100,cy=-100,tx=-100,ty=-100;const desktop=matchMedia('(pointer:fine)').matches;
  if(desktop){addEventListener('pointermove',e=>{tx=e.clientX;ty=e.clientY});const move=()=>{cx+=(tx-cx)*.22;cy+=(ty-cy)*.22;cursor.style.transform=`translate(${cx}px,${cy}px) translate(-50%,-50%)`;requestAnimationFrame(move)};move();}
  home.querySelectorAll('a,button,article').forEach(el=>{el.addEventListener('mouseenter',()=>cursor.classList.add('hover'));el.addEventListener('mouseleave',()=>cursor.classList.remove('hover'))});
  addEventListener('pointerdown',()=>cursor.classList.add('click'));addEventListener('pointerup',()=>cursor.classList.remove('click'));
  const ambient=document.createElement('div');ambient.className='ambient';['♡','✦','·','✧','≋'].forEach(mark=>{const s=document.createElement('span');s.className='ambient-bit';s.textContent=mark;ambient.appendChild(s)});world.appendChild(ambient);
  document.addEventListener('click',e=>{const el=e.target.closest('button,a');if(!el||el.closest('.loading-screen'))return;el.animate?.([{transform:'scale(.98)'},{transform:'scale(1)'}],{duration:130,easing:'ease-out'})},{passive:true});
})();
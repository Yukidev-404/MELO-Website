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

  /* ROOM 07 — PLAYER CARD */
  function buildPlayerCard(){
    const room=document.querySelector('.room[data-room="profile"]');
    if(!room)return;
    room.innerHTML=`
      <button class="room-close" type="button">← BACK</button>
      <div class="pc-wrap">
        <div class="room-kicker">ROOM 07 / YOUR IDENTITY</div>
        <div class="pc-heading"><div><h2>PLAYER CARD.</h2><p>Your little MELO identity. Your listening life, in one card.</p></div><span class="pc-stamp">MELO<br>07</span></div>
        <div class="pc-stage">
          <article class="melo-player-card" aria-label="MELO Player Card preview">
            <div class="pc-top"><span><i></i> MELO PLAYER CARD</span><strong>MC / 001</strong></div>
            <div class="pc-main">
              <div class="pc-avatar"><div class="pc-avatar-ring"></div><img src="assets/melo-cat.png?v=20260915-2" alt="MELO mascot"></div>
              <div class="pc-identity"><small>PLAYER</small><h3>YOUR NAME</h3><p>@your-melo-id</p><div class="pc-status"><span></span> LISTENING IN MELO</div></div>
            </div>
            <div class="pc-rule"></div>
            <div class="pc-stats">
              <div><small>MINUTES</small><b>—</b></div><div><small>RECORDS</small><b>—</b></div><div><small>STREAK</small><b>—</b></div>
            </div>
            <div class="pc-bottom"><div><small>FAVOURITE MOOD</small><strong>not discovered yet</strong></div><div class="pc-code" aria-hidden="true"></div></div>
            <div class="pc-watermark">MUSIC FOR A BETTER YOU.</div>
          </article>
        </div>
        <div class="pc-foot"><span>PREVIEW CARD</span><b>Sign in to make this yours →</b><a href="login.html">SIGN IN</a></div>
      </div>`;
  }
  function installPlayerCardStyles(){
    if(document.getElementById('player-card-styles'))return;
    const s=document.createElement('style');s.id='player-card-styles';s.textContent=`
      .pc-wrap{max-width:1100px;margin:0 auto}.pc-heading{display:flex;justify-content:space-between;align-items:flex-start;gap:30px}.pc-heading h2{margin-bottom:14px}.pc-heading p{max-width:520px;margin:0;color:#70695f;font-size:10px;line-height:1.7}.pc-stamp{border:1px solid var(--ink);padding:10px 13px;font-family:'Space Grotesk';font-size:11px;line-height:1.05;text-align:center;transform:rotate(2deg);background:var(--white);box-shadow:4px 4px 0 rgba(23,21,20,.1)}
      .pc-stage{margin:38px auto 24px;display:flex;justify-content:center;perspective:1200px}.melo-player-card{position:relative;width:min(720px,100%);min-height:390px;background:var(--white);border:2px solid var(--ink);box-shadow:12px 12px 0 rgba(23,21,20,.14);padding:20px 24px;overflow:hidden;isolation:isolate}.melo-player-card:before{content:'';position:absolute;inset:10px;border:1px solid rgba(23,21,20,.18);pointer-events:none}.melo-player-card:after{content:'';position:absolute;width:260px;height:260px;border:1px solid rgba(255,59,152,.2);border-radius:50%;right:-80px;bottom:-90px;box-shadow:0 0 0 22px rgba(255,59,152,.025),0 0 0 45px rgba(255,59,152,.018);z-index:-1}.pc-top{display:flex;justify-content:space-between;align-items:center;font-size:8px;letter-spacing:.08em}.pc-top i{display:inline-block;width:7px;height:7px;background:var(--pink);border-radius:50%;margin-right:4px}.pc-top strong{font-weight:400;color:#777}.pc-main{display:grid;grid-template-columns:190px 1fr;gap:28px;align-items:center;margin:34px 15px 25px}.pc-avatar{height:180px;width:180px;position:relative;display:grid;place-items:center;background:#eee5da;border:1px solid var(--ink);overflow:hidden}.pc-avatar:before{content:'';position:absolute;inset:12px;border:1px dashed rgba(23,21,20,.25);border-radius:50%}.pc-avatar-ring{position:absolute;width:140px;height:140px;border:1px solid rgba(255,59,152,.42);border-radius:50%}.pc-avatar img{width:145px;height:145px;object-fit:contain;position:relative;z-index:2;filter:drop-shadow(4px 6px 0 rgba(23,21,20,.1))}.pc-identity small,.pc-stats small,.pc-bottom small{font-size:7px;color:#888;letter-spacing:.12em}.pc-identity h3{font-family:'Space Grotesk';font-size:42px;line-height:.9;letter-spacing:-.06em;margin:8px 0 7px}.pc-identity p{font-size:10px;margin:0;color:#777}.pc-status{display:inline-flex;align-items:center;gap:6px;margin-top:24px;border:1px solid #aaa;padding:7px 9px;font-size:7px}.pc-status span{width:6px;height:6px;border-radius:50%;background:var(--pink);animation:pcPulse 1.5s ease-in-out infinite}.pc-rule{height:1px;background:rgba(23,21,20,.3);margin:0 15px}.pc-stats{display:grid;grid-template-columns:repeat(3,1fr);margin:19px 15px}.pc-stats div{border-right:1px solid rgba(23,21,20,.18);padding:0 15px}.pc-stats div:first-child{padding-left:0}.pc-stats div:last-child{border-right:0}.pc-stats b{display:block;font-family:'Space Grotesk';font-size:25px;margin-top:4px}.pc-bottom{display:flex;justify-content:space-between;align-items:end;margin:13px 15px 0}.pc-bottom strong{display:block;font-family:'Space Grotesk';font-size:12px;margin-top:5px}.pc-code{width:75px;height:32px;background:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 5px);opacity:.7}.pc-watermark{position:absolute;right:24px;top:50%;transform:translateY(-50%) rotate(90deg);font-size:7px;color:rgba(23,21,20,.24);letter-spacing:.18em}.pc-foot{max-width:720px;margin:0 auto;display:flex;align-items:center;gap:14px;font-size:8px}.pc-foot span{color:var(--pink);font-size:7px;border:1px solid var(--pink);padding:5px 7px}.pc-foot b{font-weight:400;color:#777}.pc-foot a{margin-left:auto;border:1px solid var(--ink);background:var(--ink);color:white;padding:9px 13px;font-size:8px}.pc-foot a:hover{background:var(--pink);border-color:var(--pink)}@keyframes pcPulse{50%{transform:scale(.65);opacity:.5}}
      @media(max-width:700px){.pc-wrap{padding-bottom:25px}.pc-heading{align-items:flex-start}.pc-heading h2{font-size:clamp(42px,13vw,68px)}.pc-stamp{display:none}.pc-stage{margin-top:25px}.melo-player-card{min-height:0;padding:15px 17px;box-shadow:7px 8px 0 rgba(23,21,20,.14)}.pc-main{grid-template-columns:105px 1fr;gap:16px;margin:28px 8px 20px}.pc-avatar{width:105px;height:105px}.pc-avatar img{width:88px;height:88px}.pc-avatar-ring{width:80px;height:80px}.pc-identity h3{font-size:27px}.pc-status{margin-top:15px;font-size:6px}.pc-stats{margin:15px 8px}.pc-stats div{padding:0 8px}.pc-stats b{font-size:19px}.pc-bottom{margin:10px 8px 0}.pc-watermark{display:none}.pc-foot{flex-wrap:wrap}.pc-foot a{margin-left:0}}
    `;document.head.appendChild(s);
  }
  installPlayerCardStyles();buildPlayerCard();
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
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();nextCard(e.key);return}
    if(e.key===' '){e.preventDefault();togglePlayback()}
  });
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.open)));document.querySelectorAll('.room-close').forEach(b=>b.addEventListener('click',()=>b.closest('.room').classList.remove('open')));
  play?.addEventListener('click',e=>{e.stopPropagation();togglePlayback()});player?.addEventListener('click',e=>{if(e.target.closest('button'))return;togglePlayback()});
  bar?.addEventListener('click',e=>{const r=bar.getBoundingClientRect();bar.querySelector('i')?.style.setProperty('width',Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100))+'%')});
  document.querySelectorAll('.room-row button').forEach(b=>b.addEventListener('click',()=>{b.textContent=b.textContent==='QUEUE'?'QUEUED ✓':'PLAYING ✓';b.style.background='var(--pink)';b.style.color='#fff'}));
  document.querySelectorAll('.theme').forEach(theme=>theme.addEventListener('click',()=>{document.querySelectorAll('.theme').forEach(x=>x.classList.remove('active'));theme.classList.add('active');if(theme.dataset.color)document.documentElement.style.setProperty('--pink',theme.dataset.color)}));
  document.getElementById('backHome')?.addEventListener('click',e=>{e.preventDefault();rooms.forEach(r=>r.classList.remove('open'))});document.querySelectorAll('.player-action').forEach(b=>b.addEventListener('click',()=>openRoom('library')));
})();

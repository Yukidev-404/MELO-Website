(() => {
  const loading=document.getElementById('loadingScreen'), loadingFill=document.getElementById('loadingFill'), loadingPercent=document.getElementById('loadingPercent'), loadingLabel=document.getElementById('loadingLabel');
  const loadingBar=loading?.querySelector('.loading-bar');
  const boot=document.getElementById('boot'), inner=document.querySelector('.boot-inner'), entry=document.getElementById('enter'), map=document.getElementById('map'), player=document.getElementById('player'), play=document.getElementById('play'), bar=document.querySelector('.bar'), title=document.querySelector('.song'), artist=document.querySelector('.artist'), rooms=[...document.querySelectorAll('.room')];
  let playing=false, track=0, entering=false, hoverPlayed=false;
  const tracks=[['Pleasure','Dylan Sinclair'],['Enough','Deukota'],['Get It Together','Télépomusik Lofi Flip']];
  const hoverSfx=new Audio('assets/melo-entry-hover.mp3?v=20260915-2');
  const clickSfx=new Audio('assets/melo-entry-click.mp3?v=20260915-2');
  const audio=new Audio();
  audio.preload='metadata';
  audio.volume=.9;
  const imported=[];
  let importedIndex=-1;
  let objectUrls=[];
  hoverSfx.preload='auto'; clickSfx.preload='auto'; hoverSfx.volume=1; clickSfx.volume=.65;

  function playSfx(a){try{a.currentTime=0;const p=a.play();if(p?.catch)p.catch(()=>{});}catch{}}
  function startLoading(){
    if(!loading)return;
    const start=performance.now();
    function tick(now){const progress=Math.min(100,((now-start)/2300)*100);if(loadingFill)loadingFill.style.width=progress+'%';if(loadingPercent)loadingPercent.textContent=Math.floor(progress)+'%';if(loadingBar)loadingBar.setAttribute('aria-valuenow',String(Math.floor(progress)));if(progress<100)requestAnimationFrame(tick)}
    requestAnimationFrame(tick);
    setTimeout(()=>loading?.classList.add('ring-on'),300); setTimeout(()=>loading?.classList.add('accent'),1000);
    setTimeout(()=>{if(loadingLabel)loadingLabel.textContent='loading melo...'},1750);
    setTimeout(()=>{loading?.classList.add('ready');if(loadingLabel)loadingLabel.textContent='ready ♡';if(loadingFill)loadingFill.style.width='100%';if(loadingPercent)loadingPercent.textContent='100%';if(loadingBar)loadingBar.setAttribute('aria-valuenow','100')},2080);
    setTimeout(()=>loading?.classList.add('done'),2300);
  }
  function enter(){if(entering||boot.classList.contains('hide'))return;entering=true;inner?.classList.remove('rim-hover');inner?.classList.add('rim-active');playSfx(clickSfx);setTimeout(()=>{boot.classList.add('hide');map.classList.add('ready')},720)}
  function openRoom(name){rooms.forEach(r=>r.classList.toggle('open',r.dataset.room===name))}
  function setVisualTrack(name,who){title.textContent=name;artist.textContent=who}
  function updatePlayButton(){play.textContent=playing?'❚❚':'▶';player.classList.toggle('playing',playing)}
  function formatTime(seconds){if(!Number.isFinite(seconds))return '00:00';const m=Math.floor(seconds/60),s=Math.floor(seconds%60);return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0')}
  function updateProgress(){if(!bar)return;const pct=audio.duration?audio.currentTime/audio.duration*100:0;const fill=bar.querySelector('i');if(fill)fill.style.width=pct+'%';const times=bar.parentElement?.querySelector('.time');if(times){const spans=times.querySelectorAll('span');if(spans.length>1){spans[0].textContent=formatTime(audio.currentTime);spans[1].textContent=formatTime(audio.duration)}}}
  function playImported(i){
    if(!imported.length)return;
    importedIndex=(i+imported.length)%imported.length;
    const item=imported[importedIndex];
    audio.src=item.url; audio.load(); setVisualTrack(item.name,item.artist); playing=true; updatePlayButton();
    audio.play().catch(()=>{playing=false;updatePlayButton()});
    document.querySelectorAll('.melo-imported-row').forEach((row,n)=>row.classList.toggle('is-playing',n===importedIndex));
  }
  function togglePlayback(){
    if(!audio.src){chooseMusic();return}
    if(audio.paused){audio.play().then(()=>{playing=true;updatePlayButton()}).catch(()=>{});}else{audio.pause();playing=false;updatePlayButton()}
  }
  function chooseMusic(){musicInput?.click()}
  function renderImported(){
    const list=document.querySelector('[data-room="library"] .room-list');if(!list)return;
    list.querySelectorAll('.melo-imported-row').forEach(x=>x.remove());
    imported.forEach((item,i)=>{
      const row=document.createElement('div');row.className='room-row melo-imported-row';
      row.innerHTML=`<b>${String(i+5).padStart(2,'0')}</b><div><strong></strong><small>your browser file · ${item.type||'audio'}</small></div><button type="button">PLAY</button>`;
      row.querySelector('strong').textContent=item.name;
      row.querySelector('button').addEventListener('click',()=>playImported(i));
      list.appendChild(row);
    });
  }
  function importFiles(files){
    [...files].filter(f=>f.type.startsWith('audio/')||/\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(f.name)).forEach(file=>{
      const url=URL.createObjectURL(file);objectUrls.push(url);
      const base=file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ');
      imported.push({name:base,artist:'Local file',url,type:file.type||'audio'});
    });
    renderImported();
    if(imported.length && importedIndex<0)playImported(0);
    if(musicInput)musicInput.value='';
  }
  function setupWebPlayer(){
    const library=document.querySelector('[data-room="library"]');if(!library)return;
    const controls=document.createElement('div');controls.className='melo-library-tools';
    controls.innerHTML='<button type="button" class="melo-import-btn">＋ ADD MUSIC</button><span class="melo-library-status">browser library · local files stay on this device</span>';
    library.querySelector('.room-list')?.before(controls);
    musicInput=document.createElement('input');musicInput.type='file';musicInput.accept='audio/*';musicInput.multiple=true;musicInput.hidden=true;musicInput.setAttribute('aria-label','Choose music files');
    document.body.appendChild(musicInput);
    controls.querySelector('.melo-import-btn').addEventListener('click',chooseMusic);musicInput.addEventListener('change',e=>importFiles(e.target.files));
    window.addEventListener('beforeunload',()=>objectUrls.forEach(URL.revokeObjectURL));
  }
  let musicInput=null;

  startLoading(); setupWebPlayer();
  entry?.addEventListener('mouseenter',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering){hoverPlayed=true;playSfx(hoverSfx)}});
  entry?.addEventListener('mouseleave',()=>{if(!entering){inner?.classList.remove('rim-hover');hoverPlayed=false}});
  entry?.addEventListener('focus',()=>{inner?.classList.add('rim-hover');if(!hoverPlayed&&!entering){hoverPlayed=true;playSfx(hoverSfx)}});
  entry?.addEventListener('blur',()=>{if(!entering)inner?.classList.remove('rim-hover')});
  entry?.addEventListener('pointerdown',()=>inner?.classList.add('rim-active')); entry?.addEventListener('click',enter);
  document.addEventListener('keydown',e=>{
    if(e.key==='Enter'&&!boot.classList.contains('hide'))enter();
    if(e.key==='Escape')rooms.forEach(r=>r.classList.remove('open'));
    if(e.key==='ArrowRight'&&imported.length)playImported(importedIndex+1);
    if(e.key==='ArrowLeft'&&imported.length)playImported(importedIndex-1);
    if(e.key===' '&&boot.classList.contains('hide')){e.preventDefault();togglePlayback()}
  });
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openRoom(b.dataset.open)));
  document.querySelectorAll('.room-close').forEach(b=>b.addEventListener('click',()=>b.closest('.room').classList.remove('open')));
  play?.addEventListener('click',e=>{e.stopPropagation();togglePlayback()});
  player?.addEventListener('click',e=>{if(e.target.closest('button'))return;togglePlayback()});
  document.getElementById('nextTrack')?.addEventListener('click',()=>imported.length?playImported(importedIndex+1):chooseMusic());
  document.getElementById('prevTrack')?.addEventListener('click',()=>imported.length?playImported(importedIndex-1):chooseMusic());
  bar?.addEventListener('click',e=>{if(!audio.duration)return;const r=bar.getBoundingClientRect();audio.currentTime=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width))*audio.duration;updateProgress()});
  audio.addEventListener('timeupdate',updateProgress);
  audio.addEventListener('loadedmetadata',updateProgress);
  audio.addEventListener('play',()=>{playing=true;updatePlayButton()});
  audio.addEventListener('pause',()=>{playing=false;updatePlayButton()});
  audio.addEventListener('ended',()=>{if(imported.length)playImported(importedIndex+1);else{playing=false;updatePlayButton()}});
  document.querySelectorAll('[data-track-room]').forEach(b=>b.addEventListener('click',()=>{if(imported.length)playImported(Number(b.dataset.trackRoom)%imported.length);else chooseMusic()}));
  document.querySelectorAll('.room-row button:not([data-track-room])').forEach(b=>{if(b.closest('.melo-imported-row'))return;b.addEventListener('click',()=>{b.textContent=b.textContent==='QUEUE'?'QUEUED ✓':'PLAYING ✓';b.style.background='var(--pink)';b.style.color='#fff'})});
  document.querySelectorAll('.theme').forEach(theme=>theme.addEventListener('click',()=>{document.querySelectorAll('.theme').forEach(x=>x.classList.remove('active'));theme.classList.add('active');if(theme.dataset.color)document.documentElement.style.setProperty('--pink',theme.dataset.color)}));
  document.getElementById('backHome')?.addEventListener('click',e=>{e.preventDefault();rooms.forEach(r=>r.classList.remove('open'))});
  document.querySelectorAll('.player-action').forEach(b=>b.addEventListener('click',()=>openRoom('library')));
})();

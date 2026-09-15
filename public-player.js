/* MELO interactive homepage player */
(() => {
  const boot = () => {
    const app = document.querySelector('.hero-art .app-window');
    if (!app) return;

    const player = app.querySelector('.mini-player');
    const play = app.querySelector('.controls button');
    const vinyls = [...app.querySelectorAll('.small-vinyl,.hero-vinyl')];
    const progress = app.querySelector('.fake-progress');
    const progressFill = app.querySelector('.fake-progress i');
    const volume = app.querySelector('.volume span');
    const trackName = app.querySelector('.mini-track strong');
    const artistName = app.querySelector('.mini-track small');
    const rows = [...app.querySelectorAll('.track-lines p')];
    const tabs = [...app.querySelectorAll('.tabs span')];
    const search = app.querySelector('.search');

    const tracks = [
      ['Enough','Deukota'],
      ['Get It Together','Télépomusik Lofi Flip'],
      ['Pleasure','Dylan Sinclair'],
      ['Smokin Out The Window','Bruno Mars, Anderson .Paak'],
      ['Let Me Love You','Mario']
    ];
    let playing = false;
    let timer = null;
    let position = 35;

    if (search) {
      const input = document.createElement('input');
      input.type = 'search';
      input.placeholder = 'Search music...';
      input.setAttribute('aria-label','Search music');
      search.textContent = '';
      search.append('⌕', input);
      const clear = document.createElement('b');
      clear.textContent = '×';
      clear.title = 'Clear search';
      search.append(clear);
      clear.addEventListener('click', () => { input.value=''; filterRows(''); input.focus(); });
      input.addEventListener('input', () => filterRows(input.value));
    }

    function filterRows(query){
      const q = query.trim().toLowerCase();
      rows.forEach(row => row.hidden = q && !row.textContent.toLowerCase().includes(q));
    }

    function setPlaying(next){
      playing = next;
      app.classList.toggle('is-playing', playing);
      vinyls.forEach(v => v.classList.toggle('is-spinning', playing));
      if (play) {
        play.classList.add('play-button');
        play.textContent = playing ? '❚❚' : '▶';
        play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
      }
      if (timer) clearInterval(timer);
      if (playing) {
        timer = setInterval(() => {
          position += .8;
          if (position >= 100) position = 0;
          if (progressFill) progressFill.style.width = position + '%';
        }, 700);
      }
    }

    function chooseTrack(index){
      const [name,artist] = tracks[index] || tracks[2];
      if (trackName) trackName.textContent = name;
      if (artistName) artistName.textContent = artist;
      rows.forEach((row,i) => row.classList.toggle('selected-track', i === index));
      position = 0;
      if (progressFill) progressFill.style.width = '0%';
      setPlaying(true);
    }

    if (play) {
      play.addEventListener('click', () => setPlaying(!playing));
    }
    vinyls.forEach(v => v.addEventListener('click', () => setPlaying(!playing)));

    rows.forEach((row,index) => row.addEventListener('click', () => chooseTrack(index)));

    const controlSpans = [...app.querySelectorAll('.controls span')];
    controlSpans.forEach((control,index) => {
      control.setAttribute('role','button');
      control.setAttribute('tabindex','0');
      control.addEventListener('keydown', e => { if(e.key==='Enter'||e.key===' ') { e.preventDefault(); control.click(); } });
      control.addEventListener('click', () => {
        if(index === 1 || index === 3) chooseTrack(index === 1 ? 1 : 3);
        else if(index === 0 || index === 4) control.classList.toggle('player-active');
      });
    });

    if (progress) progress.addEventListener('click', e => {
      const r = progress.getBoundingClientRect();
      position = Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
      if(progressFill) progressFill.style.width=position+'%';
    });

    if (volume) volume.addEventListener('click', e => {
      const r=volume.getBoundingClientRect();
      const pct=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
      volume.style.setProperty('--volume',pct+'%');
      const label=app.querySelector('.volume');
      if(label){ const txt=label.lastChild; if(txt && txt.nodeType===3) txt.textContent=' '+Math.round(pct)+'%'; }
    });

    tabs.forEach(tab => tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('selected'));
      tab.classList.add('selected');
      const mode=tab.textContent.trim();
      rows.forEach((row,i)=>row.hidden=false);
      if(mode==='FAVORITES') rows.forEach((row,i)=>row.hidden=!([2,4].includes(i)));
      if(mode==='RECENT') rows.forEach((row,i)=>row.hidden=i<2);
      if(mode==='QUEUE') rows.forEach((row,i)=>row.hidden=i===2);
    }));

    // Gentle mouse tilt makes the player feel like a physical object.
    app.addEventListener('pointermove', e => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const r=app.getBoundingClientRect();
      const x=(e.clientX-r.left)/r.width-.5;
      const y=(e.clientY-r.top)/r.height-.5;
      app.style.transform=`perspective(1200px) rotateY(${x*1.5}deg) rotateX(${y*-1.2}deg)`;
    });
    app.addEventListener('pointerleave', () => { app.style.transform=''; });

    setPlaying(false);
    if (play) play.textContent='▶';
  };
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else boot();
})();

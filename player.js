(()=>{'use strict';const $=id=>document.getElementById(id),audio=$('audio'),content=$('content'),record=$('record');const AUTH='https://accounts.spotify.com/authorize',TOKEN='https://accounts.spotify.com/api/token',API='https://api.spotify.com/v1',REDIRECT_URI='https://yukidev-404.github.io/MELO-Website/melo-web.html',SCOPES=['user-read-private','user-read-email','user-read-recently-played','user-library-read','user-library-modify','playlist-read-private','playlist-read-collaborative','playlist-modify-private','playlist-modify-public','user-read-playback-state','user-modify-playback-state','user-read-currently-playing','streaming'].join(' ');const s={source:'SPOTIFY',tab:'LIBRARY',tracks:[],localTracks:[],current:-1,currentTrack:null,queue:[],favorites:[],playlists:[],recent:[],shuffle:false,repeat:'off',spotify:null,player:null,device:null,timer:null,urls:[],lastSpotifyState:null,spotifyProfile:null,playlistContext:null,searchResults:null,searchPlaylists:null,searchQuery:''};let localDirHandle=null;let vizFrame=0,vizCtx=null,vizAnalyser=null,vizSource=null,vizData=null,vizPhase=0,vizLast=performance.now();let lyricLines=[];for(let i=0;i<48;i++){const b=document.createElement('i');b.className='bar';$('visualizer').appendChild(b)}
const vizBars=()=>Array.from(document.querySelectorAll('.bar'));
function vizReset(){vizBars().forEach(b=>b.style.height='3px')}
function vizEnsureLocalAnalyser(){
  if(vizAnalyser||!audio)return;
  try{
    vizCtx=new (window.AudioContext||window.webkitAudioContext)();
    vizAnalyser=vizCtx.createAnalyser();
    vizAnalyser.fftSize=1024;
    vizAnalyser.minDecibels=-90;
    vizAnalyser.maxDecibels=-10;
    vizAnalyser.smoothingTimeConstant=.78;
    vizData=new Uint8Array(vizAnalyser.frequencyBinCount);
    vizSource=vizCtx.createMediaElementSource(audio);
    vizSource.connect(vizAnalyser);
    vizAnalyser.connect(vizCtx.destination);
  }catch{vizCtx=null;vizAnalyser=null;vizData=null}
}
function vizDesktopSpotify(t){
  const bars=vizBars(),now=performance.now(),dt=Math.min(40,now-vizLast);vizLast=now;
  if(!t||t.paused){
    bars.forEach(b=>{const h=parseFloat(b.style.height)||3;b.style.height=Math.max(3,h-dt*.055)+'px'});
    return;
  }
  const pos=Math.max(0,Number(t.position)||0)/1000;
  const duration=Math.max(1,Number(t.duration)||1)/1000;
  const progress=Math.min(1,pos/duration);
  const trackId=String(t.track_window?.current_track?.id||'melo');
  let hash=0;for(let i=0;i<trackId.length;i++)hash=(hash*31+trackId.charCodeAt(i))>>>0;

  // Song-aware visual engine. Spotify no longer exposes Audio Analysis to new
  // third-party apps, so this uses playback position + deterministic per-track
  // phase/energy instead of pretending to have waveform data.
  const bpm=96+(hash%49); // 96–144 BPM visual tempo, stable for this track.
  const beat=pos*bpm/60;
  const beatFrac=beat-Math.floor(beat);
  const beatPulse=Math.pow(Math.max(0,1-Math.min(1,beatFrac)*3.2),2.2);
  const section=Math.sin(progress*Math.PI*8+(hash%37))*.5+.5;
  const energy=.45+.55*(.5+.5*Math.sin(progress*Math.PI*6.0+(hash%71)));
  const drop=Math.pow(Math.max(0,Math.sin(progress*Math.PI*4+(hash%23))*.5+.5),3);
  vizPhase+=dt*.004;

  bars.forEach((bar,i)=>{
    const x=i/Math.max(1,bars.length-1);
    const bass=Math.pow(1-x,1.55);
    const mid=1-Math.abs(x-.48)*1.65;
    const high=Math.max(0,x-.58)/.42;
    const wave=.5+.5*Math.sin(beat*Math.PI*2+i*.57+vizPhase+(hash%97)/13);
    const stagger=.5+.5*Math.sin(beat*Math.PI*2*(1.5+bass*.8)+i*.31+hash%19);
    const target=3+
      energy*(6+12*bass)+
      section*(4+8*mid)+
      wave*(4+10*(.25+bass*.75))+
      stagger*4+
      beatPulse*(9*bass+5*mid)+
      drop*(5*bass+3*high);
    const current=parseFloat(bar.style.height)||3;
    const smoothing=target>current ? .34 : .115;
    bar.style.height=(current+(target-current)*Math.min(1,smoothing)).toFixed(2)+'px';
  });
}function vizLocal(){
  if(!vizAnalyser||!vizData){return}
  if(vizCtx?.state==='suspended')vizCtx.resume().catch(()=>{});
  vizAnalyser.getByteFrequencyData(vizData);
  const bars=vizBars(),bins=vizData.length;
  bars.forEach((b,i)=>{
    const a=Math.floor(Math.pow(i/bars.length,1.7)*(bins*.62)),z=Math.max(a+1,Math.floor(Math.pow((i+1)/bars.length,1.7)*(bins*.62)));
    let sum=0;for(let j=a;j<z;j++)sum+=vizData[j];
    const avg=sum/Math.max(1,z-a),bass=1-i/bars.length;
    const target=3+Math.pow(avg/255,.72)*(12+bass*25);
    const current=parseFloat(b.style.height)||3;
    b.style.height=(current+(target-current)*(target>current ? .34 : .12)).toFixed(2)+'px';
  });
}
function vizLoop(){
  vizFrame=requestAnimationFrame(vizLoop);
  if(s.source==='LOCAL')vizLocal();
  else vizDesktopSpotify(s.lastSpotifyState);
}
vizLoop();function vizLocal(){
  if(!vizAnalyser||!vizData){vizDesktopSpotify(s.lastSpotifyState);return}
  if(vizCtx?.state==='suspended')vizCtx.resume().catch(()=>{});
  vizAnalyser.getByteFrequencyData(vizData);
  const bars=vizBars(), bins=vizData.length;
  bars.forEach((b,i)=>{
    const a=Math.floor(Math.pow(i/bars.length,1.7)*(bins*.62)), z=Math.max(a+1,Math.floor(Math.pow((i+1)/bars.length,1.7)*(bins*.62)));
    let sum=0;for(let j=a;j<z;j++)sum+=vizData[j];
    const avg=sum/Math.max(1,z-a), bass=1-i/bars.length;
    const target=3+Math.pow(avg/255,.72)*(12+bass*25);
    const current=parseFloat(b.style.height)||3;
    b.style.height=(current+(target-current)*(target>current ? .34 : .12)).toFixed(2)+'px';
  });
}
function vizLoop(){
  vizFrame=requestAnimationFrame(vizLoop);
  if(s.source==='LOCAL')vizLocal();else vizDesktopSpotify(s.lastSpotifyState);
}
vizLoop();const fmt=v=>{v=Math.max(0,Math.floor(Number(v)||0));return`${Math.floor(v/60)}:${String(v%60).padStart(2,'0')}`},esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));function msg(v){$('spotifyMessage').textContent=v||''}function redirect(){return REDIRECT_URI}function b64(a){let x='';a.forEach(v=>x+=String.fromCharCode(v));return btoa(x).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}function rand(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return b64(a)}async function hash(v){return crypto.subtle.digest('SHA-256',new TextEncoder().encode(v))}async function meloProfile(){try{const r=await fetch('https://melo-website.tajtaranga.workers.dev/api/profile',{credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));return r.ok&&d.authenticated?d:null}catch{return null}}
async function connectSpotifyToMelo(){const d=await meloProfile();if(!d){msg('Sign in to your MELO account first.');setTimeout(()=>location.href='login.html?next='+encodeURIComponent('melo-web.html'),700);return}location.href='https://melo-website.tajtaranga.workers.dev/api/auth/oauth/spotify?mode=connect'}
async function meloSpotifyConnection(){try{const d=await meloProfile();if(!d)return null;const r=await fetch('https://melo-website.tajtaranga.workers.dev/api/auth/connections',{credentials:'include',cache:'no-store'});const data=await r.json().catch(()=>({}));return (data.connections||[]).find(x=>String(x.provider||'').toLowerCase()==='spotify')||null}catch{return null}}
async function refreshMeloSpotifyConnection(){const c=await meloSpotifyConnection();if(c){const name=c.provider_email||c.provider_name||'Spotify account';msg('SPOTIFY LINKED · '+name+'. Player token handoff is the next backend step.');$('sourceStatus').textContent='SPOTIFY LINKED · '+name;return c}if(!s.spotify)$('sourceStatus').textContent='SPOTIFY NOT CONNECTED';return null}
function openSpotify(){const modal=$('spotifyModal');if(!modal)return;modal.classList.add('open');modal.setAttribute('aria-hidden','false');const disconnect=$('spotifyDisconnect');if(disconnect)disconnect.style.display=s.spotify?'block':'none';const connect=$('spotifyConnect');if(connect)connect.textContent='CONNECT SPOTIFY TO MELO →';if(s.spotifyProfile)msg(`PLAYER CONNECTED · ${s.spotifyProfile.display_name||s.spotifyProfile.id||'SPOTIFY'}`);else refreshMeloSpotifyConnection()}function closeSpotify(){const modal=$('spotifyModal');if(!modal)return;modal.classList.remove('open');modal.setAttribute('aria-hidden','true')}async function login(){const client=$('spotifyClientId').value.trim();if(!/^[A-Za-z0-9]{20,64}$/.test(client)){msg('Enter a valid Spotify Client ID (20–64 letters/numbers).');return}localStorage.setItem('melo_spotify_client_id',client);const verifier=rand(64),challenge=b64(new Uint8Array(await hash(verifier))),state=rand(32);sessionStorage.setItem('melo_pkce',JSON.stringify({verifier,state,client,created:Date.now()}));const u=new URL(AUTH);u.searchParams.set('client_id',client);u.searchParams.set('response_type','code');u.searchParams.set('redirect_uri',redirect());u.searchParams.set('scope',SCOPES);u.searchParams.set('code_challenge_method','S256');u.searchParams.set('code_challenge',challenge);u.searchParams.set('state',state);location.href=u}async function callback(){const p=new URLSearchParams(location.search),code=p.get('code'),err=p.get('error'),st=p.get('state');if(!code&&!err)return;history.replaceState({},'',location.pathname);const x=JSON.parse(sessionStorage.getItem('melo_pkce')||'null');sessionStorage.removeItem('melo_pkce');if(err){openSpotify();msg(`Spotify authorization: ${p.get('error_description')||err}`);return}if(!x||x.state!==st||x.client!==String(localStorage.getItem('melo_spotify_client_id')||x.client)||Date.now()-Number(x.created||0)>10*60*1000){openSpotify();msg('Spotify authorization state is invalid or expired. Please try again.');return}try{const body=new URLSearchParams({client_id:x.client,grant_type:'authorization_code',code,redirect_uri:redirect(),code_verifier:x.verifier});const r=await fetch(TOKEN,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const d=await r.json();if(!r.ok)throw Error(d.error_description||d.error);s.spotify={client:x.client,access:d.access_token,refresh:d.refresh_token||'',expires:Date.now()+Number(d.expires_in||3600)*1000-60000};save();await profile();await sdk();s.source='SPOTIFY';await sourceUI();closeSpotify()}catch(e){openSpotify();msg(`Spotify connection failed: ${e.message}`)}}function save(){/* Spotify credentials stay with the MELO backend. */}
function bindSpotifySetup(){const close=$('spotifyClose'),connect=$('spotifyConnect'),toggle=$('toggleClientId'),copy=$('copyRedirect'),disconnect=$('spotifyDisconnect'),input=$('spotifyClientId');close?.addEventListener('click',closeSpotify);connect?.addEventListener('click',connectSpotifyToMelo);toggle?.addEventListener('click',()=>{if(!input)return;const reveal=input.type==='password';input.type=reveal?'text':'password';toggle.textContent=reveal?'HIDE':'SHOW'});copy?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(redirect());copy.textContent='COPIED';setTimeout(()=>copy.textContent='COPY',1200)}catch{msg('Could not copy the redirect URI.')}});disconnect?.addEventListener('click',()=>{s.spotify=null;s.spotifyProfile=null;if(s.player){try{s.player.disconnect()}catch{}s.player=null}s.device=null;sourceUI();closeSpotify();msg('Spotify playback disconnected from this browser.')});$('spotifyModal')?.addEventListener('click',e=>{if(e.target===$('spotifyModal'))closeSpotify()})}async function load(){
  try{
    const r=await fetch('https://melo-website.tajtaranga.workers.dev/api/auth/spotify/token',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:'{}',cache:'no-store'});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.access_token){s.spotify=null;return false}
    s.spotify={access:d.access_token,expires:Date.now()+Math.max(60,Number(d.expires_in||3600))*1000-60000,scope:String(d.scope||'')};
    return true;
  }catch{s.spotify=null;return false}
}async function api(path,o={}){if(!s.spotify)throw Error('Spotify is not connected.');if(!s.spotify||s.spotify.expires<=Date.now()){const ok=await load();if(!ok)throw Error('Spotify session expired. Reconnect Spotify.')}const r=await fetch(API+path,{...o,headers:{Authorization:`Bearer ${s.spotify.access}`,'Content-Type':'application/json',...(o.headers||{})}});if(r.status===204)return null;const d=await r.json().catch(()=>null);if(r.status===401){s.spotify=null;s.spotifyProfile=null;$('sourceStatus').textContent='SESSION EXPIRED';throw Error('Spotify session expired. Reconnect Spotify.')}if(!r.ok)throw Error(d?.error?.message||`Spotify API HTTP ${r.status}`);return d}function track(t){if(!t)return null;return{id:t.id,uri:t.uri,name:t.name||'Unknown Track',artist:(t.artists||[]).map(a=>a.name).join(', ')||'Unknown Artist',album:t.album?.name||'Unknown Album',image:t.album?.images?.[0]?.url||'',duration:t.duration_ms||0,url:t.external_urls?.spotify||'',playable:t.is_playable!==false}}async function profile(){try{const p=await api('/me');s.spotifyProfile=p;const name=p.display_name||p.id||'SPOTIFY';$('sourceStatus').textContent=`CONNECTED · ${name}`;msg(`Connected as ${name}`);return p}catch(e){s.spotifyProfile=null;$('sourceStatus').textContent='SESSION EXPIRED';throw e}}async function sdk(){if(!s.spotify||!window.Spotify)return;if(s.player){try{await s.player.disconnect()}catch{}s.player=null;s.device=null}const p=new Spotify.Player({name:'MELO Web Player',getOAuthToken:async cb=>{try{if(s.spotify.expires<=Date.now())await api('/me');cb(s.spotify.access)}catch(e){msg(e.message);cb('')}},volume:Number(localStorage.getItem('melo_volume')||75)/100,enableMediaSession:true});p.addListener('ready',d=>{s.device=d.device_id;$('deviceName').textContent='DEVICE: MELO WEB PLAYER';$('sourceStatus').textContent='CONNECTED · '+(s.spotifyProfile?.display_name||s.spotifyProfile?.id||'SPOTIFY')});p.addListener('not_ready',()=>{$('deviceName').textContent='DEVICE: SPOTIFY OFFLINE'});p.addListener('initialization_error',d=>{msg('Spotify player initialization failed: '+(d?.message||'Unknown error'))});p.addListener('authentication_error',d=>{$('sourceStatus').textContent='SESSION EXPIRED';msg(d?.message||'Spotify authentication expired.');s.spotify=null;s.spotifyProfile=null});p.addListener('account_error',d=>{msg(d?.message||'Spotify Premium is required for MELO Web playback.')});p.addListener('playback_error',d=>{msg(d?.message||'Spotify playback error.')});p.addListener('autoplay_failed',()=>{msg('Spotify needs one interaction before playback can start.')});p.addListener('player_state_changed',st=>{if(!st)return;s.lastSpotifyState=st;const t=track(st.track_window?.current_track);if(t)setCurrent(t,true);$('elapsed').textContent=fmt(st.position/1000);$('duration').textContent=fmt(st.duration/1000);$('progressFill').style.width=st.duration?String(st.position/st.duration*100)+'%':'0%';syncLyrics(st.position/1000);if(t&&!st.paused){s.recent=[t,...s.recent.filter(v=>v.id!==t.id)].slice(0,100);persistLocal()}record.classList.toggle('playing',!st.paused);$('playIcon').src=st.paused?'assets/custom_play.png':'assets/custom_pause.png';});;const connected=await p.connect();if(!connected){s.player=null;s.device=null;msg('Spotify Web Player could not connect. Check your browser permissions and Spotify account.');return}s.player=p}window.onSpotifyWebPlaybackSDKReady=()=>{if(load())sdk()};async function spotifyPlay(t){if(!s.player||!s.device)throw Error('MELO Spotify Web Player is not ready yet.');if(!t?.uri)throw Error('This Spotify track has no playable URI.');try{await s.player.activateElement()}catch{}try{await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[s.device],play:false})});}catch(e){throw Error('Could not activate MELO Spotify device: '+e.message)}try{await api('/me/player/play?device_id='+encodeURIComponent(s.device),{method:'PUT',body:JSON.stringify({uris:[t.uri],position_ms:0})});}catch(e){throw Error('Spotify playback command failed: '+e.message)}}
function setCurrent(t,spotify){s.currentTrack=t;s.current=s.tracks.findIndex(x=>x.id===t.id);$('trackTitle').textContent=t.name;$('trackArtist').textContent=t.artist;if(!spotify){$('playIcon').src='assets/custom_pause.png';record.classList.add('playing')}else record.classList.add('playing');updateFavoriteUI(t)}
async function play(i){
  const t=s.tracks[i];if(!t)return;
  if(s.source==='SPOTIFY'){
    try{
      if(s.tab==='PLAYLISTS'&&s.playlistContext)s.playlistContext.index=i;
      else if(s.playlistContext&&s.tracks===s.playlistContext.tracks)s.playlistContext.index=i;
      else if(s.playlistContext){const pi=s.playlistContext.tracks.findIndex(x=>x.id===t.id);if(pi>=0)s.playlistContext.index=pi}
      setCurrent(t,true);await spotifyPlay(t)
    }catch(e){msg(e.message);if(!s.spotify)openSpotify()}
  }else{audio.src=t.url;s.current=i;setCurrent(t);audio.play().catch(()=>{})}
}
async function next(){
  if(s.source==='SPOTIFY'){
    try{
      if(s.queue.length){const t=s.queue.shift();setCurrent(t,true);await spotifyPlay(t);persistLocal();return}
      if(s.playlistContext?.tracks?.length){
        const ctx=s.playlistContext;
        let i=ctx.index+1;
        if(i<ctx.tracks.length){ctx.index=i;s.tracks=ctx.tracks;await play(i);return}
        if(s.repeat==='context'){ctx.index=0;s.tracks=ctx.tracks;await play(0);return}
      }
      if(!s.player)throw Error('Spotify Web Player is not ready yet.');
      await s.player.nextTrack();return
    }catch(e){msg(e.message);return}
  }
  if(s.queue.length){const t=s.queue.shift();s.tracks=s.localTracks;const i=s.tracks.findIndex(x=>x.id===t.id);if(i>=0)await play(i);persistLocal();return}
  if(s.tracks.length){let i=s.shuffle?Math.floor(Math.random()*s.tracks.length):(s.current+1)%s.tracks.length;if(s.current<0)i=0;await play(i)}
}
async function prev(){
  if(s.source==='SPOTIFY'){
    try{
      const st=s.lastSpotifyState;
      if(st&&st.position>3000){await s.player.seek(0);return}
      if(s.queue.length){msg('PREVIOUS IS UNAVAILABLE WHILE MELO QUEUE IS ACTIVE');return}
      if(s.playlistContext?.tracks?.length){
        const ctx=s.playlistContext,i=ctx.index-1;
        if(i>=0){ctx.index=i;s.tracks=ctx.tracks;await play(i);return}
      }
      if(!s.player)throw Error('Spotify Web Player is not ready yet.');
      await s.player.previousTrack()
    }catch(e){msg(e.message)}
  }else if(s.current>0)await play(s.current-1)
}
async function toggle(){if(s.source==='SPOTIFY'){try{if(!s.player)throw Error('Spotify Web Player is not ready yet.');const st=s.lastSpotifyState;if(st?.paused)await s.player.resume();else if(st)await s.player.pause();else await spotifyPlay(s.currentTrack||s.tracks[0]);}catch(e){msg(e.message)}}else audio.paused?play(s.current<0?0:s.current):audio.pause()}

async function openLocalDB(){return new Promise((resolve,reject)=>{const r=indexedDB.open('melo-local',1);r.onupgradeneeded=()=>r.result.createObjectStore('handles');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function saveLocalDirHandle(h){try{const db=await openLocalDB();const tx=db.transaction('handles','readwrite');tx.objectStore('handles').put(h,'music');await new Promise((res,rej)=>{tx.oncomplete=res;tx.onerror=()=>rej(tx.error)});db.close()}catch{}}
async function loadLocalDirHandle(){try{const db=await openLocalDB();const tx=db.transaction('handles','readonly');const r=tx.objectStore('handles').get('music');const h=await new Promise((res,rej)=>{r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error)});db.close();return h||null}catch{return null}}
async function dirPermission(h,write=false){try{return (await h.queryPermission({mode:write?'readwrite':'read'}))==='granted'||(await h.requestPermission({mode:write?'readwrite':'read'}))==='granted'}catch{return false}}
async function scanLocalDirectory(h){const files=[];async function walk(dir,prefix=''){for await(const [name,entry] of dir.entries()){if(entry.kind==='file'){const f=await entry.getFile();if(f.type.startsWith('audio/')||/\.(mp3|wav|flac|m4a|aac|ogg|opus|webm)$/i.test(name))files.push({file:f,path:prefix+name})}else if(entry.kind==='directory'&&files.length<5000)await walk(entry,prefix+name+'/')}}await walk(h);s.urls.forEach(URL.revokeObjectURL);s.urls=[];s.localTracks=files.map(({file,path})=>{const u=URL.createObjectURL(file);s.urls.push(u);return{id:path,uri:'',name:file.name.replace(/\.[^.]+$/,''),artist:'LOCAL FILE',album:path,duration:0,url:u}});s.tracks=s.localTracks.slice();s.current=-1;s.tab='LIBRARY';render()}
async function pickLocalFolder(){if('showDirectoryPicker' in window){try{const h=await window.showDirectoryPicker({mode:'read'});if(await dirPermission(h)){localDirHandle=h;await saveLocalDirHandle(h);await scanLocalDirectory(h);return}}catch(e){if(e?.name==='AbortError')return}}$('folder').click()}
function persistLocal(){try{localStorage.setItem('melo_recent',JSON.stringify(s.recent.slice(0,100)));localStorage.setItem('melo_favorites',JSON.stringify(s.favorites))}catch{}}
function updateFavoriteUI(t){const liked=!!t&&s.favorites.some(v=>v.id===t.id);const img=$('favorite')?.querySelector('img');if(img)img.src=liked?'assets/favorite_wave_active.png':'assets/favorite_wave.png'}
async function tabLoad(){
  // Every tab owns its own dataset. Clear the previous tab's tracks first so
  // FAVORITES can never leak into LIST (or another tab).
  s.searchResults=null;
  s.searchPlaylists=null;
  s.playlistContext=null;
  if(s.source==='LOCAL'){
    s.tracks=s.localTracks.slice();
    if(s.tab==='FAVORITES')s.tracks=s.favorites.slice();
    else if(s.tab==='RECENT')s.tracks=s.recent.slice();
    else if(s.tab==='QUEUE')s.tracks=s.queue.slice();
    else if(s.tab==='PLAYLISTS')s.tracks=[];
    render();
    return;
  }
  try{
    if(s.tab==='LIBRARY'){
      // LIST is the neutral/default view. It must not reuse the previous tab's data.
      s.tracks=[];
    }else if(s.tab==='FAVORITES'){
      const d=await api('/me/tracks?limit=50');
      s.tracks=(d.items||[]).map(x=>track(x.track)).filter(Boolean);
      s.favorites=s.tracks.slice();
    }else if(s.tab==='RECENT'){
      const d=await api('/me/player/recently-played?limit=50');
      s.tracks=(d.items||[]).map(x=>track(x.track)).filter(Boolean);
    }else if(s.tab==='QUEUE'){
      const d=await api('/me/player/queue');
      s.tracks=[track(d.current_track),...(d.queue||[]).map(track)].filter(Boolean);
    }else if(s.tab==='PLAYLISTS'){
      const d=await api('/me/playlists?limit=50');
      s.playlists=(d.items||[]).map(p=>({id:p.id,name:p.name,total:p.items?.total||0,image:p.images?.[0]?.url||'',owner:p.owner?.display_name||p.owner?.id||'Spotify'}));
      s.tracks=[];
    }
    render();
  }catch(e){
    s.tracks=[];
    render();
    $('sourceStatus').textContent='OFFLINE';
    content.innerHTML=`<div class="empty">${esc(e.message)}</div>`;
  }
}function render(){
  let list=s.searchResults ? s.searchResults.slice() : (s.tracks||[]).slice();
  const q=$('search').value.trim().toLowerCase();
  if(s.source==='LOCAL'&&q)list=list.filter(t=>`${t.name} ${t.artist} ${t.album}`.toLowerCase().includes(q));
  if(s.tab==='PLAYLISTS'&&s.source==='SPOTIFY'){
    const pls=s.searchPlaylists||s.playlists||[];
    content.innerHTML=pls.length?`<div class="playlist-grid">${pls.map(p=>`<article class="playlist-card" data-pl="${esc(p.id)}"><div class="playlist-cover">${p.image?`<img src="${esc(p.image)}" alt="">`:'<span>♪</span>'}</div><div class="playlist-card-meta"><div class="playlist-card-title" title="${esc(p.name)}">${esc(p.name)}</div><div class="playlist-card-owner">by ${esc(p.owner||'Spotify')}</div><div class="playlist-card-count">${esc(p.total)} tracks</div></div><button class="playlist-open" type="button">OPEN</button></article>`).join('')}</div>`:'<div class="empty">NO PLAYLISTS FOUND</div>';
    content.querySelectorAll('.playlist-card').forEach(r=>r.onclick=()=>playlist(r.dataset.pl));
    return;
  }
  if(!list.length){content.innerHTML='<div class="empty">NO MUSIC AVAILABLE';if(s.searchQuery)content.innerHTML='<div class="empty">NO RESULTS FOR '+esc(s.searchQuery)+'</div>';return}
  content.innerHTML=list.map((t,i)=>`<div class="track-row" data-i="${i}"><span class="num">${String(i+1).padStart(2,'0')}</span><div><b>${esc(t.name)}</b><small>${esc(t.artist)} · ${esc(t.album)}</small></div><button data-menu="${esc(t.id)}">⋯</button></div>`).join('');
  content.querySelectorAll('.track-row').forEach(r=>r.onclick=e=>{if(e.target.closest('button'))return;play(Number(r.dataset.i))});
  content.querySelectorAll('[data-menu]').forEach(b=>b.onclick=e=>{e.stopPropagation();trackMenu(e.clientX,e.clientY,b.dataset.menu)});
}async function playlist(id){
  try{
    const meta=await api(`/playlists/${encodeURIComponent(id)}`);
    const d=await api(`/playlists/${encodeURIComponent(id)}/items?limit=100`);
    const tracks=(d.items||[]).map(x=>track(x.item||x.track)).filter(Boolean);
    s.playlistContext={id:String(id),name:meta?.name||'PLAYLIST',tracks,index:-1};
    s.tracks=tracks.slice();
    s.current=-1;
    s.tab='LIBRARY';
    render();
    msg(`PLAYLIST · ${s.playlistContext.name} · ${tracks.length} TRACKS`);
  }catch(e){msg(e.message)}
}function trackMenu(x,y,id){const t=s.tracks.find(v=>v.id===id),m=$('contextMenu');if(!t)return;m.innerHTML='<button data-a="q">Add Selected to Queue</button><button data-a="f">Add Selected to Favorites</button>';m.classList.add('open');m.style.left=`${Math.min(x,innerWidth-245)}px`;m.style.top=`${Math.min(y,innerHeight-120)}px`;m.querySelector('[data-a="q"]').onclick=async()=>{try{s.queue.push(t);msg(`ADDED TO MELO QUEUE · ${s.queue.length}`)}catch(e){msg(e.message)}m.classList.remove('open')};m.querySelector('[data-a="f"]').onclick=async()=>{try{if(s.source==='SPOTIFY')await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'PUT'});else{s.favorites=[...s.favorites.filter(v=>v.id!==t.id),t];localStorage.setItem('melo_favorites',JSON.stringify(s.favorites))}msg('SAVED')}catch(e){msg(e.message)}m.classList.remove('open')}}async function search(q){
  q=String(q||'').trim();
  s.searchQuery=q;
  if(!q){s.searchResults=null;s.searchPlaylists=null;await tabLoad();return}
  if(s.source!=='SPOTIFY'){s.searchResults=null;s.searchPlaylists=null;render();return}
  try{
    if(s.tab==='PLAYLISTS'){
      const d=await api(`/search?type=playlist&limit=50&q=${encodeURIComponent(q)}`);
      s.searchPlaylists=(d.playlists?.items||[]).filter(Boolean).map(p=>({id:p.id,name:p.name,total:p.items?.total||0,image:p.images?.[0]?.url||'',owner:p.owner?.display_name||p.owner?.id||'Spotify'}));
      s.searchResults=null;
    }else{
      const d=await api(`/search?type=track&limit=50&q=${encodeURIComponent(q)}`);
      s.searchResults=(d.tracks?.items||[]).map(track).filter(Boolean);
      s.searchPlaylists=null;
    }
    render();
  }catch(e){content.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}async function sourceUI(){const sp=s.source==='SPOTIFY';if($('source'))$('source').textContent='SPOTIFY';if(!sp){s.tracks=s.localTracks.slice();s.current=-1;render();$('sourceStatus').textContent='LOCAL MUSIC';updateFavoriteUI(s.currentTrack)}else await tabLoad()}$('source')?.addEventListener('click',openSpotify);$('settings').onclick=openSpotify;$('closeLyrics').onclick=()=>$('lyricsPanel').classList.remove('open');function renderLyrics(data){lyricLines=Array.isArray(data?.lines)?data.lines:[];const body=$('lyricsBody');if(!body)return;if(!lyricLines.length){body.textContent='NO LYRICS';return}body.innerHTML=lyricLines.map((l,i)=>{const tm=l.time==null?'':String(l.time);return '<button class="lyric-line" data-time="'+tm+'" data-i="'+i+'">'+esc(l.text)+'</button>'}).join('');body.querySelectorAll('.lyric-line').forEach(b=>b.onclick=()=>{const t=Number(b.dataset.time);if(!Number.isFinite(t))return;if(s.source==='LOCAL'&&audio.duration)audio.currentTime=t;else if(s.currentTrack)api('/me/player/seek?position_ms='+Math.round(t*1000),{method:'PUT'}).catch(e=>msg(e.message))})}
function syncLyrics(position){const body=$('lyricsBody');if(!body||!lyricLines.length)return;let active=-1;for(let i=0;i<lyricLines.length;i++){const t=Number(lyricLines[i].time);if(Number.isFinite(t)&&position>=t)active=i;else if(Number.isFinite(t)&&position<t)break}body.querySelectorAll('.lyric-line').forEach((b,i)=>b.classList.toggle('active',i===active));if(active>=0){const el=body.querySelector('.lyric-line.active');el?.scrollIntoView({block:'center',behavior:'smooth'})}}
$('previous').onclick=prev;$('play').onclick=toggle;$('next').onclick=next;
$('lyrics').onclick=async()=>{const t=s.currentTrack;$('lyricsPanel').classList.add('open');$('lyricsTitle').textContent=t?.name||'Lyrics';$('lyricsArtist').textContent=t?.artist||'';$('lyricsBody').textContent='LOADING LYRICS…';lyricLines=[];if(!t){$('lyricsBody').textContent='NO LYRICS';return}try{const r=await fetch('https://lrclib.net/api/get?track_name='+encodeURIComponent(t.name)+'&artist_name='+encodeURIComponent(t.artist)),d=await r.json();if(!d?.syncedLyrics&&!d?.plainLyrics)throw Error('Lyrics not found');const raw=d.syncedLyrics||d.plainLyrics||'';const lines=[];if(d.syncedLyrics){raw.split(/\r?\n/).forEach(line=>{const m=[...line.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)];const text=line.replace(/\[[^\]]+\]/g,'').trim();if(text)m.forEach(x=>{const ms=String(x[3]||'').padEnd(3,'0').slice(0,3);lines.push({time:Number(x[1])*60+Number(x[2])+Number(ms)/1000,text})})});lines.sort((a,b)=>a.time-b.time)}else raw.split(/\r?\n/).forEach(text=>text.trim()&&lines.push({time:null,text:text.trim()}));renderLyrics({lines})}catch{$('lyricsBody').textContent='NO LYRICS'}};$('volume').oninput=e=>{const v=Number(e.target.value);audio.volume=v/100;$('volumeValue').textContent=`${v}%`;localStorage.setItem('melo_volume',v);if(s.player)s.player.setVolume(v/100).catch?.(()=>{})};$('progress').onclick=async e=>{const r=e.currentTarget.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));if(s.source==='LOCAL'&&audio.duration)audio.currentTime=audio.duration*p;else if(s.currentTrack){try{const duration=s.lastSpotifyState?.duration||s.currentTrack.duration;await api(`/me/player/seek?position_ms=${Math.round(duration*p)}`,{method:'PUT'})}catch(err){msg(err.message)}}};$('shuffle').onclick=async()=>{s.shuffle=!s.shuffle;$('shuffle').style.color=s.shuffle?'#ff47a3':'';if(s.source==='SPOTIFY')try{await api(`/me/player/shuffle?state=${s.shuffle}`,{method:'PUT'})}catch(e){msg(e.message)}};$('repeat').onclick=async()=>{s.repeat=s.repeat==='off'?'context':s.repeat==='context'?'track':'off';$('repeat').style.color=s.repeat==='off'?'':'#ff47a3';if(s.source==='SPOTIFY')try{await api(`/me/player/repeat?state=${s.repeat}`,{method:'PUT'})}catch(e){msg(e.message)}};$('favorite').onclick=async()=>{const t=s.currentTrack;if(!t)return;try{const liked=s.favorites.some(v=>v.id===t.id);if(s.source==='SPOTIFY'){if(liked)await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'DELETE'});else await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'PUT'})}if(liked)s.favorites=s.favorites.filter(v=>v.id!==t.id);else s.favorites=[...s.favorites.filter(v=>v.id!==t.id),t];persistLocal();updateFavoriteUI(t);if(s.tab==='FAVORITES')tabLoad()}catch(e){msg(e.message)}};$('search').oninput=()=>{clearTimeout(s.timer);const q=$('search').value.trim();if(s.source==='SPOTIFY')s.timer=setTimeout(()=>search(q),350);else render()};$('searchButton').onclick=()=>search($('search').value.trim());$('overflow').onclick=e=>{$('contextMenu').innerHTML='<button id="clearSearch">Clear Search</button><button id="closePlayer">Close Player</button>';$('contextMenu').classList.add('open');$('contextMenu').style.left=`${Math.min(e.clientX,innerWidth-245)}px`;$('contextMenu').style.top=`${Math.min(e.clientY,innerHeight-150)}px`;$('clearSearch').onclick=async()=>{$('search').value='';s.searchQuery='';s.searchResults=null;s.searchPlaylists=null;await tabLoad();$('contextMenu').classList.remove('open')};$('closePlayer').onclick=()=>location.href='index.html'};$('device').onclick=async()=>{if(s.source!=='SPOTIFY'){msg('Output device selection is available for Spotify playback.');return}try{const d=await api('/me/player/devices'),m=$('contextMenu');m.innerHTML=(d.devices||[]).map(v=>`<button data-d="${esc(v.id)}">${esc(v.name)}${v.is_active?' · ACTIVE':''}</button>`).join('')||'<button>NO DEVICES</button>';m.classList.add('open');(d.devices||[]).forEach(v=>m.querySelector(`[data-d="${CSS.escape(v.id)}"]`)?.addEventListener('click',async()=>{await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[v.id],play:false})});$('deviceName').textContent=`DEVICE: ${v.name}`;m.classList.remove('open')}))}catch(e){msg(e.message)}};$('folder').onchange=e=>{s.urls.forEach(URL.revokeObjectURL);s.urls=[];s.localTracks=[...e.target.files].filter(f=>f.type.startsWith('audio/')).map(f=>{const u=URL.createObjectURL(f);s.urls.push(u);return{id:crypto.randomUUID(),uri:'',name:f.name.replace(/\.[^.]+$/,''),artist:'LOCAL FILE',album:'LOCAL FILE',duration:0,url:u}});s.tracks=s.localTracks.slice();s.current=-1;s.tab='LIBRARY';document.querySelectorAll('.tabs button[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='LIBRARY'));render()};document.querySelectorAll('.tabs button[data-tab]').forEach(b=>b.onclick=async()=>{s.tab=b.dataset.tab;document.querySelectorAll('.tabs button[data-tab]').forEach(x=>x.classList.toggle('active',x===b));await tabLoad()});document.querySelector('[data-window="min"]')?.addEventListener('click',()=>{$('app').classList.toggle('minimized')});document.querySelector('[data-window="max"]')?.addEventListener('click',()=>{$('app').classList.toggle('maximized')});document.querySelector('[data-window="close"]')?.addEventListener('click',()=>location.href='index.html');document.addEventListener('click',e=>{if(!e.target.closest('#contextMenu')&&!e.target.closest('#overflow')&&!e.target.closest('[data-menu]'))$('contextMenu').classList.remove('open')});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();toggle()}if(e.key==='Escape'){closeSpotify();$('lyricsPanel').classList.remove('open');$('contextMenu').classList.remove('open')}});audio.addEventListener('play',()=>{record.classList.add('playing');$('playIcon').src='assets/custom_pause.png';const t=s.currentTrack;if(t){s.recent=[t,...s.recent.filter(v=>v.id!==t.id)].slice(0,100);persistLocal()}});audio.addEventListener('pause',()=>{record.classList.remove('playing');$('playIcon').src='assets/custom_play.png'});audio.addEventListener('ended',async()=>{if(s.repeat==='track'){audio.currentTime=0;await audio.play();return}if(s.repeat==='context'&&s.tracks.length){let i=s.shuffle?Math.floor(Math.random()*s.tracks.length):(s.current+1)%s.tracks.length;await play(i);return}await next()});audio.addEventListener('play',()=>{vizEnsureLocalAnalyser();vizCtx?.resume().catch(()=>{})});audio.addEventListener('timeupdate',()=>{if(s.source!=='LOCAL')return;$('elapsed').textContent=fmt(audio.currentTime);$('duration').textContent=fmt(audio.duration);$('progressFill').style.width=audio.duration?`${audio.currentTime/audio.duration*100}%`:'0%';syncLyrics(audio.currentTime)});(async()=>{try{s.recent=JSON.parse(localStorage.getItem('melo_recent')||'[]');s.favorites=JSON.parse(localStorage.getItem('melo_favorites')||'[]');s.localTracks=[];s.tracks=[]}catch{}const v=Number(localStorage.getItem('melo_volume')||75);audio.volume=v/100;$('volume').value=v;$('volumeValue').textContent=`${v}%`;bindSpotifySetup();await callback();const linked=await refreshMeloSpotifyConnection();if(linked){try{const hasToken=await load();if(hasToken){await profile();s.source='SPOTIFY';if(window.Spotify)await sdk();await sourceUI()}else{$('sourceStatus').textContent='SPOTIFY LINKED · TOKEN UNAVAILABLE'}}catch(e){s.source='SPOTIFY';$('sourceStatus').textContent='SPOTIFY LINKED · TOKEN ERROR';msg(e.message)}}else{$('sourceStatus').textContent='SPOTIFY NOT CONNECTED'}render()})()})();
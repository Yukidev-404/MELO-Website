(()=>{'use strict';const $=id=>document.getElementById(id),audio=$('audio'),content=$('content')        <span class="queue-number">${String(t.historyNo||1).padStart(2,'0')}</span>
        <div class="queue-track-copy"><b>${esc(t.name)} - ${esc(t.artist)}</b><small>${esc(t.album)}</small></div>
      </div>`).join(''):'<div class="empty">QUEUE IS EMPTY</div>'}
      <button class="queue-load-more" id="queueLoadMore" type="button"><span>---------</span> LOAD MORE <span>---------</span></button>
      <div class="queue-section-title">RECENTLY PLAYED</div>
      ${history.length?history.map(t=>`<div class="queue-history" data-history-id="${esc(queueTrackKey(t))}">
        ${t.queueNo?'<span class="queue-number">'+String(t.queueNo).padStart(2,'0')+'</span>':'<span class="queue-number queue-number-empty">--</span>'}
        <div class="queue-track-copy"><b>${esc(t.name)} - ${esc(t.artist)}</b><small>${esc(t.album)}</small></div>
      </div>`).join(''):'<div class="empty">NO PLAYED HISTORY</div>'}
    </div>`;
  content.querySelectorAll('.queue-item').forEach(r=>r.onclick=async()=>{
    const i=Number(r.dataset.qIndex);
    const t=[...s.queue,...s.autoQueue][i];
    try{await playQueueTrack(t)}catch(e){msg(e.message)}
  });
  $('queueLoadMore')?.addEventListener('click',async()=>{
    const btn=$('queueLoadMore');
    if(!btn)return;
    btn.disabled=true;
    btn.innerHTML='<span>---------</span> LOADING… <span>---------</span>';
    try{
      const before=s.autoQueue.length;
      await refillAutoQueue(true);
      const added=s.autoQueue.length-before;
      if(added)msg('ADDED '+added+' MORE SONG'+(added===1?'':'S')+' TO QUEUE');
      renderQueue();
    }catch(e){
      btn.disabled=false;
      btn.innerHTML='<span>---------</span> LOAD MORE <span>---------</span>';
      msg(e.message);
    }
  });
  content.querySelectorAll('.queue-history').forEach(r=>r.onclick=async()=>{
    const t=s.queueHistory.find(x=>queueTrackKey(x)===r.dataset.historyId);
    if(!t)return;
    try{await playQueueTrack(t)}catch(e){msg(e.message)}
  });
}
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
    else if(s.tab==='QUEUE')s.tracks=[];
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
  if(s.tab==='QUEUE'&&s.source==='SPOTIFY'){renderQueue();return}
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
}function trackMenu(x,y,id){const t=s.tracks.find(v=>v.id===id),m=$('contextMenu');if(!t)return;m.innerHTML='<button data-a="q">Add Selected to Queue</button><button data-a="f">Add Selected to Favorites</button>';m.classList.add('open');m.style.left=`${Math.min(x,innerWidth-245)}px`;m.style.top=`${Math.min(y,innerHeight-120)}px`;m.querySelector('[data-a="q"]').onclick=async()=>{try{s.queue.push({...t});renumberUpcomingQueue();if(s.tab==='QUEUE')renderQueue();msg(`ADDED TO MELO QUEUE · ${s.queue.length}`)}catch(e){msg(e.message)}m.classList.remove('open')};m.querySelector('[data-a="f"]').onclick=async()=>{try{if(s.source==='SPOTIFY')await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'PUT'});else{s.favorites=[...s.favorites.filter(v=>v.id!==t.id),t];localStorage.setItem('melo_favorites',JSON.stringify(s.favorites))}msg('SAVED')}catch(e){msg(e.message)}m.classList.remove('open')}}async function search(q){
  q=String(q||'').trim();
  s.searchQuery=q;
  if(!q){s.searchResults=null;s.searchPlaylists=null;await tabLoad();return}
  if(s.source!=='SPOTIFY'){s.searchResults=null;s.searchPlaylists=null;render();return}
  try{
    if(s.tab==='PLAYLISTS'){
      const d=await api(`/search?type=playlist&limit=10&q=${encodeURIComponent(q)}`);
      s.searchPlaylists=(d.playlists?.items||[]).filter(Boolean).map(p=>({id:p.id,name:p.name,total:p.items?.total||0,image:p.images?.[0]?.url||'',owner:p.owner?.display_name||p.owner?.id||'Spotify'}));
      s.searchResults=null;
    }else{
      const d=await api(`/search?type=track&limit=10&q=${encodeURIComponent(q)}`);
      s.searchResults=(d.tracks?.items||[]).map(track).filter(Boolean);
      s.searchPlaylists=null;
    }
    render();
  }catch(e){content.innerHTML=`<div class="empty">${esc(e.message)}</div>`}
}async function sourceUI(){const sp=s.source==='SPOTIFY';if($('source'))$('source').textContent='SPOTIFY';if(!sp){s.tracks=s.localTracks.slice();s.current=-1;render();$('sourceStatus').textContent='LOCAL MUSIC';updateFavoriteUI(s.currentTrack)}else await tabLoad()}$('source')?.addEventListener('click',openSpotify);$('settings').onclick=openSpotify;$('closeLyrics').onclick=()=>$('lyricsPanel').classList.remove('open');function renderLyrics(data){lyricLines=Array.isArray(data?.lines)?data.lines:[];const body=$('lyricsBody');if(!body)return;if(!lyricLines.length){body.textContent='NO LYRICS';return}body.innerHTML=lyricLines.map((l,i)=>{const tm=l.time==null?'':String(l.time);return '<button class="lyric-line" data-time="'+tm+'" data-i="'+i+'">'+esc(l.text)+'</button>'}).join('');body.querySelectorAll('.lyric-line').forEach(b=>b.onclick=()=>{const t=Number(b.dataset.time);if(!Number.isFinite(t))return;if(s.source==='LOCAL'&&audio.duration)audio.currentTime=t;else if(s.currentTrack)api('/me/player/seek?position_ms='+Math.round(t*1000),{method:'PUT'}).catch(e=>msg(e.message))})}
function syncLyrics(position){const body=$('lyricsBody');if(!body||!lyricLines.length)return;let active=-1;for(let i=0;i<lyricLines.length;i++){const t=Number(lyricLines[i].time);if(Number.isFinite(t)&&position>=t)active=i;else if(Number.isFinite(t)&&position<t)break}body.querySelectorAll('.lyric-line').forEach((b,i)=>b.classList.toggle('active',i===active));if(active>=0){const el=body.querySelector('.lyric-line.active');el?.scrollIntoView({block:'center',behavior:'smooth'})}}
$('previous').onclick=prev;$('play').onclick=toggle;$('next').onclick=next;
$('lyrics').onclick=async()=>{const t=s.currentTrack;$('lyricsPanel').classList.add('open');$('lyricsTitle').textContent=t?.name||'Lyrics';$('lyricsArtist').textContent=t?.artist||'';$('lyricsBody').textContent='LOADING LYRICS…';lyricLines=[];if(!t){$('lyricsBody').textContent='NO LYRICS';return}try{const r=await fetch('https://lrclib.net/api/get?track_name='+encodeURIComponent(t.name)+'&artist_name='+encodeURIComponent(t.artist)),d=await r.json();if(!d?.syncedLyrics&&!d?.plainLyrics)throw Error('Lyrics not found');const raw=d.syncedLyrics||d.plainLyrics||'';const lines=[];if(d.syncedLyrics){raw.split(/\r?\n/).forEach(line=>{const m=[...line.matchAll(/\[(\d+):(\d{2})(?:\.(\d{1,3}))?\]/g)];const text=line.replace(/\[[^\]]+\]/g,'').trim();if(text)m.forEach(x=>{const ms=String(x[3]||'').padEnd(3,'0').slice(0,3);lines.push({time:Number(x[1])*60+Number(x[2])+Number(ms)/1000,text})})});lines.sort((a,b)=>a.time-b.time)}else raw.split(/\r?\n/).forEach(text=>text.trim()&&lines.push({time:null,text:text.trim()}));renderLyrics({lines})}catch{$('lyricsBody').textContent='NO LYRICS'}};$('volume').oninput=e=>{const v=Number(e.target.value);audio.volume=v/100;$('volumeValue').textContent=`${v}%`;localStorage.setItem('melo_volume',v);if(s.player)s.player.setVolume(v/100).catch?.(()=>{})};$('progress').onclick=async e=>{const r=e.currentTarget.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));if(s.source==='LOCAL'&&audio.duration)audio.currentTime=audio.duration*p;else if(s.currentTrack){try{const duration=s.lastSpotifyState?.duration||s.currentTrack.duration;await api(`/me/player/seek?position_ms=${Math.round(duration*p)}`,{method:'PUT'})}catch(err){msg(err.message)}}};$('shuffle').onclick=async()=>{s.shuffle=!s.shuffle;$('shuffle').style.color=s.shuffle?'#ff47a3':'';if(s.source==='SPOTIFY')try{await api(`/me/player/shuffle?state=${s.shuffle}`,{method:'PUT'})}catch(e){msg(e.message)}};$('repeat').onclick=async()=>{s.repeat=s.repeat==='off'?'context':s.repeat==='context'?'track':'off';$('repeat').style.color=s.repeat==='off'?'':'#ff47a3';if(s.source==='SPOTIFY')try{await api(`/me/player/repeat?state=${s.repeat}`,{method:'PUT'})}catch(e){msg(e.message)}};$('favorite').onclick=async()=>{const t=s.currentTrack;if(!t)return;try{const liked=s.favorites.some(v=>v.id===t.id);if(s.source==='SPOTIFY'){if(liked)await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'DELETE'});else await api(`/me/library?uris=${encodeURIComponent(t.uri)}`,{method:'PUT'})}if(liked)s.favorites=s.favorites.filter(v=>v.id!==t.id);else s.favorites=[...s.favorites.filter(v=>v.id!==t.id),t];persistLocal();updateFavoriteUI(t);if(s.tab==='FAVORITES')tabLoad()}catch(e){msg(e.message)}};$('search').oninput=()=>{clearTimeout(s.timer);const q=$('search').value.trim();if(s.source==='SPOTIFY')s.timer=setTimeout(()=>search(q),350);else render()};$('searchButton').onclick=()=>search($('search').value.trim());$('overflow').onclick=e=>{$('contextMenu').innerHTML='<button id="clearSearch">Clear Search</button><button id="closePlayer">Close Player</button>';$('contextMenu').classList.add('open');$('contextMenu').style.left=`${Math.min(e.clientX,innerWidth-245)}px`;$('contextMenu').style.top=`${Math.min(e.clientY,innerHeight-150)}px`;$('clearSearch').onclick=async()=>{$('search').value='';s.searchQuery='';s.searchResults=null;s.searchPlaylists=null;await tabLoad();$('contextMenu').classList.remove('open')};$('closePlayer').onclick=()=>location.href='index.html'};$('device').onclick=async()=>{if(s.source!=='SPOTIFY'){msg('Output device selection is available for Spotify playback.');return}try{const d=await api('/me/player/devices'),m=$('contextMenu');m.innerHTML=(d.devices||[]).map(v=>`<button data-d="${esc(v.id)}">${esc(v.name)}${v.is_active?' · ACTIVE':''}</button>`).join('')||'<button>NO DEVICES</button>';m.classList.add('open');(d.devices||[]).forEach(v=>m.querySelector(`[data-d="${CSS.escape(v.id)}"]`)?.addEventListener('click',async()=>{await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[v.id],play:false})});$('deviceName').textContent=`DEVICE: ${v.name}`;m.classList.remove('open')}))}catch(e){msg(e.message)}};$('folder').onchange=e=>{s.urls.forEach(URL.revokeObjectURL);s.urls=[];s.localTracks=[...e.target.files].filter(f=>f.type.startsWith('audio/')).map(f=>{const u=URL.createObjectURL(f);s.urls.push(u);return{id:crypto.randomUUID(),uri:'',name:f.name.replace(/\.[^.]+$/,''),artist:'LOCAL FILE',album:'LOCAL FILE',duration:0,url:u}});s.tracks=s.localTracks.slice();s.current=-1;s.tab='LIBRARY';document.querySelectorAll('.tabs button[data-tab]').forEach(x=>x.classList.toggle('active',x.dataset.tab==='LIBRARY'));render()};document.querySelectorAll('.tabs button[data-tab]').forEach(b=>b.onclick=async()=>{s.tab=b.dataset.tab;document.querySelectorAll('.tabs button[data-tab]').forEach(x=>x.classList.toggle('active',x===b));await tabLoad()});document.querySelector('[data-window="min"]')?.addEventListener('click',()=>{$('app').classList.toggle('minimized')});document.querySelector('[data-window="max"]')?.addEventListener('click',()=>{$('app').classList.toggle('maximized')});document.querySelector('[data-window="close"]')?.addEventListener('click',()=>location.href='index.html');document.addEventListener('click',e=>{if(!e.target.closest('#contextMenu')&&!e.target.closest('#overflow')&&!e.target.closest('[data-menu]'))$('contextMenu').classList.remove('open')});window.addEventListener('keydown',e=>{if(e.code==='Space'&&!['INPUT','TEXTAREA'].includes(document.activeElement.tagName)){e.preventDefault();toggle()}if(e.key==='Escape'){closeSpotify();$('lyricsPanel').classList.remove('open');$('contextMenu').classList.remove('open')}});audio.addEventListener('play',()=>{record.classList.add('playing');$('playIcon').src='assets/custom_pause.png';const t=s.currentTrack;if(t){s.recent=[t,...s.recent.filter(v=>v.id!==t.id)].slice(0,100);persistLocal()}});audio.addEventListener('pause',()=>{record.classList.remove('playing');$('playIcon').src='assets/custom_play.png'});audio.addEventListener('ended',async()=>{if(s.repeat==='track'){audio.currentTime=0;await audio.play();return}if(s.repeat==='context'&&s.tracks.length){let i=s.shuffle?Math.floor(Math.random()*s.tracks.length):(s.current+1)%s.tracks.length;await play(i);return}await next()});audio.addEventListener('play',()=>{vizEnsureLocalAnalyser();vizCtx?.resume().catch(()=>{})});audio.addEventListener('timeupdate',()=>{if(s.source!=='LOCAL')return;$('elapsed').textContent=fmt(audio.currentTime);$('duration').textContent=fmt(audio.duration);$('progressFill').style.width=audio.duration?`${audio.currentTime/audio.duration*100}%`:'0%';syncLyrics(audio.currentTime)});(async()=>{try{s.recent=JSON.parse(localStorage.getItem('melo_recent')||'[]');s.favorites=JSON.parse(localStorage.getItem('melo_favorites')||'[]');s.localTracks=[];s.tracks=[]}catch{}const v=Number(localStorage.getItem('melo_volume')||75);audio.volume=v/100;$('volume').value=v;$('volumeValue').textContent=`${v}%`;bindSpotifySetup();await callback();const linked=await refreshMeloSpotifyConnection();if(linked){try{const hasToken=await load();if(hasToken){await profile();s.source='SPOTIFY';if(window.Spotify)await sdk();await sourceUI()}else{$('sourceStatus').textContent='SPOTIFY LINKED · TOKEN UNAVAILABLE'}}catch(e){s.source='SPOTIFY';$('sourceStatus').textContent='SPOTIFY LINKED · TOKEN ERROR';msg(e.message)}}else{$('sourceStatus').textContent='SPOTIFY NOT CONNECTED'}render()})()})();
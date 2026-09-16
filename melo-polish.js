(() => {
  const API_BASE='https://melo-website.tajtaranga.workers.dev';

  const css=`
  #melo-player-card-room{position:relative;min-height:100%;padding:clamp(22px,4vw,48px);overflow:auto;background:#f5f0e8;color:#171514}
  #melo-player-card-room .pc2-close{position:absolute;top:22px;left:22px;border:1px solid #171514;background:transparent;color:#171514;padding:9px 13px;font:700 9px/1 'Space Grotesk',sans-serif;letter-spacing:.12em;cursor:pointer;z-index:5}
  #melo-player-card-room .pc2-close:hover{background:#171514;color:#fff}
  .pc2-shell{max-width:1120px;margin:0 auto;padding-top:34px}
  .pc2-eyebrow{display:flex;align-items:center;gap:9px;font:700 9px/1 'Space Grotesk',sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6f685f}
  .pc2-dot{width:7px;height:7px;border-radius:50%;background:#ff3b98;box-shadow:0 0 0 4px rgba(255,59,152,.1)}
  .pc2-head{display:flex;justify-content:space-between;align-items:flex-end;gap:25px;margin:18px 0 30px}
  .pc2-head h2{margin:0;font:800 clamp(48px,8vw,96px)/.82 'Space Grotesk',sans-serif;letter-spacing:-.075em}
  .pc2-head p{max-width:330px;margin:0;color:#766e65;font:400 10px/1.65 'Space Grotesk',sans-serif}
  .pc2-number{font:800 11px/1 'Space Grotesk',sans-serif;letter-spacing:.12em;border:1px solid #171514;padding:10px 12px;transform:rotate(2deg);white-space:nowrap}
  .pc2-card{position:relative;background:#fffdf9;border:2px solid #171514;box-shadow:12px 12px 0 rgba(23,21,20,.13);min-height:430px;overflow:hidden}
  .pc2-card:before{content:'';position:absolute;inset:12px;border:1px solid rgba(23,21,20,.13);pointer-events:none}
  .pc2-card:after{content:'MELO';position:absolute;right:-25px;bottom:-30px;font:900 150px/.8 'Space Grotesk',sans-serif;letter-spacing:-.1em;color:rgba(255,59,152,.055);transform:rotate(-8deg);pointer-events:none}
  .pc2-top{display:flex;justify-content:space-between;align-items:center;padding:20px 24px;font:700 8px/1 'Space Grotesk',sans-serif;letter-spacing:.14em}
  .pc2-top span:first-child{display:flex;align-items:center;gap:7px}.pc2-top i{width:7px;height:7px;border-radius:50%;background:#ff3b98;display:inline-block}.pc2-top b{font-weight:500;color:#817970}
  .pc2-body{display:grid;grid-template-columns:260px 1fr;gap:42px;align-items:center;padding:34px 55px 30px}
  .pc2-avatar{position:relative;width:240px;height:240px;background:#eee6db;border:1px solid #171514;display:grid;place-items:center;overflow:hidden}
  .pc2-avatar:before{content:'';position:absolute;width:190px;height:190px;border:1px dashed rgba(23,21,20,.22);border-radius:50%}
  .pc2-avatar:after{content:'';position:absolute;width:158px;height:158px;border:1px solid rgba(255,59,152,.45);border-radius:50%}
  .pc2-avatar img{position:relative;z-index:2;width:190px;height:190px;object-fit:contain;filter:drop-shadow(7px 9px 0 rgba(23,21,20,.08))}
  .pc2-label{display:block;margin-bottom:9px;color:#8b8279;font:700 8px/1 'Space Grotesk',sans-serif;letter-spacing:.18em}
  .pc2-name{margin:0;font:800 clamp(38px,5vw,68px)/.86 'Space Grotesk',sans-serif;letter-spacing:-.065em;max-width:600px;word-break:break-word}
  .pc2-id{margin:10px 0 20px;color:#777067;font:500 11px/1 'Space Grotesk',sans-serif}
  .pc2-status{display:inline-flex;align-items:center;gap:8px;border:1px solid #171514;padding:9px 11px;font:700 8px/1 'Space Grotesk',sans-serif;letter-spacing:.08em}
  .pc2-status i{width:6px;height:6px;border-radius:50%;background:#238636;box-shadow:0 0 0 3px rgba(35,134,54,.1)}
  .pc2-rule{height:1px;background:rgba(23,21,20,.22);margin:0 55px}
  .pc2-stats{display:grid;grid-template-columns:repeat(4,1fr);margin:0 55px}
  .pc2-stat{padding:20px 18px;border-right:1px solid rgba(23,21,20,.16)}.pc2-stat:first-child{padding-left:0}.pc2-stat:last-child{border-right:0}
  .pc2-stat small{display:block;color:#8b8279;font:700 7px/1 'Space Grotesk',sans-serif;letter-spacing:.16em}.pc2-stat strong{display:block;margin-top:7px;font:800 25px/1 'Space Grotesk',sans-serif}
  .pc2-footer{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:17px 55px;border-top:1px solid rgba(23,21,20,.16);font:500 9px/1.4 'Space Grotesk',sans-serif;color:#777067}
  .pc2-footer b{color:#171514;font-weight:700}.pc2-sign{border:1px solid #171514;background:#171514;color:#fff;padding:10px 14px;font:700 8px/1 'Space Grotesk',sans-serif;letter-spacing:.08em;cursor:pointer}.pc2-sign:hover{background:#ff3b98;border-color:#ff3b98}
  .pc2-sticker{position:absolute;right:24px;top:72px;border:1px solid #ff3b98;color:#ff3b98;padding:8px 10px;font:800 8px/1.05 'Space Grotesk',sans-serif;letter-spacing:.12em;transform:rotate(4deg);background:#fffdf9}
  @media(max-width:760px){
    #melo-player-card-room{padding:18px 14px}.pc2-shell{padding-top:38px}.pc2-head{display:block;margin-bottom:22px}.pc2-head h2{font-size:clamp(50px,16vw,78px);margin-bottom:15px}.pc2-head p{max-width:100%}.pc2-number{display:none}
    .pc2-card{min-height:0;box-shadow:7px 8px 0 rgba(23,21,20,.13)}.pc2-sticker{top:62px;right:15px}.pc2-body{grid-template-columns:105px 1fr;gap:17px;padding:28px 20px 22px}.pc2-avatar{width:105px;height:105px}.pc2-avatar:before{width:82px;height:82px}.pc2-avatar:after{width:68px;height:68px}.pc2-avatar img{width:84px;height:84px}.pc2-name{font-size:29px}.pc2-id{font-size:9px;margin:8px 0 14px}.pc2-status{font-size:6px;padding:7px 8px}.pc2-rule{margin:0 20px}.pc2-stats{grid-template-columns:repeat(2,1fr);margin:0 20px}.pc2-stat{padding:14px 10px}.pc2-stat:nth-child(2){border-right:0}.pc2-stat strong{font-size:19px}.pc2-footer{padding:14px 20px;align-items:flex-start}.pc2-footer>div{max-width:65%}.pc2-sign{margin-left:auto}.pc2-card:after{font-size:80px;right:-8px;bottom:-8px}
  }
  `;

  function install(){
    if(!document.getElementById('melo-player-card-polish')){
      const style=document.createElement('style');style.id='melo-player-card-polish';style.textContent=css;document.head.appendChild(style);
    }
  }

  async function hydrate(){
    const room=document.querySelector('.room[data-room="profile"]');
    if(!room)return false;
    room.id='melo-player-card-room';
    room.innerHTML=`
      <button class="pc2-close" type="button">← BACK</button>
      <div class="pc2-shell">
        <div class="pc2-eyebrow"><i class="pc2-dot"></i> ROOM 07 / YOUR IDENTITY</div>
        <div class="pc2-head">
          <div><h2>PLAYER<br>CARD.</h2></div>
          <div><p>A small MELO identity card for the people who make music part of their everyday world.</p></div>
          <span class="pc2-number">MELO / 07</span>
        </div>
        <article class="pc2-card">
          <div class="pc2-sticker">MUSIC<br>IS YOURS.</div>
          <div class="pc2-top"><span><i></i> MELO PLAYER CARD</span><b>MC / 001</b></div>
          <div class="pc2-body">
            <div class="pc2-avatar"><img src="assets/melo-cat.png?v=20260916-1" alt="MELO mascot"></div>
            <div>
              <span class="pc2-label">PLAYER</span>
              <h3 class="pc2-name">YOUR NAME</h3>
              <p class="pc2-id">@your-melo-id</p>
              <div class="pc2-status"><i></i> MELO ACCOUNT CONNECTED</div>
            </div>
          </div>
          <div class="pc2-rule"></div>
          <div class="pc2-stats">
            <div class="pc2-stat"><small>MINUTES</small><strong>—</strong></div>
            <div class="pc2-stat"><small>RECORDS</small><strong>—</strong></div>
            <div class="pc2-stat"><small>STREAK</small><strong>—</strong></div>
            <div class="pc2-stat"><small>MOOD</small><strong>—</strong></div>
          </div>
          <div class="pc2-footer"><div><b>Your MELO identity.</b><br><span>Listening stats will appear here as your account grows.</span></div><button class="pc2-sign" type="button">SIGNED IN</button></div>
        </article>
      </div>`;

    room.querySelector('.pc2-close')?.addEventListener('click',()=>room.classList.remove('open'));

    try{
      const response=await fetch(`${API_BASE}/api/auth/me`,{credentials:'include',cache:'no-store'});
      const data=await response.json().catch(()=>({}));
      if(response.ok&&data.authenticated&&data.user){
        const user=data.user;
        const name=(user.display_name||user.email?.split('@')[0]||'MELO PLAYER').trim();
        const shortId=user.id?String(user.id).replace(/-/g,'').slice(0,8).toLowerCase():'';
        const avatar=room.querySelector('.pc2-avatar img');
        const nameEl=room.querySelector('.pc2-name');
        const idEl=room.querySelector('.pc2-id');
        if(nameEl)nameEl.textContent=name;
        if(idEl)idEl.textContent=shortId?`@melo-${shortId}`:'@melo-player';
        if(avatar&&user.avatar_url){avatar.src=user.avatar_url;avatar.alt=`${name}'s MELO avatar`;}
      }
    }catch(error){console.debug('MELO Player Card session lookup failed',error)}
    return true;
  }

  install();
  const boot=()=>{if(document.querySelector('.room[data-room="profile"]'))hydrate()};
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();

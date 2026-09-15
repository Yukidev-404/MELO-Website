(() => {
  const pages = ['home','library','customize','gallery','download','archive'];
  const contentPages = [...document.querySelectorAll('.page')];
  const navButtons = [...document.querySelectorAll('.nav-tracks button')];
  const record = document.getElementById('record');
  const rpm = document.getElementById('rpm');
  const status = document.getElementById('top-status');
  const start = document.getElementById('start');
  let current = -1, rotation = 0, spinning = false, raf;

  function showPage(name, boot = false) {
    const index = pages.indexOf(name); if (index < 0) return;
    current = index;
    contentPages.forEach(p => { const active=p.dataset.page===name; p.classList.toggle('active',active); if(active){p.classList.remove('fade');void p.offsetWidth;p.classList.add('fade');} });
    navButtons.forEach(b=>b.classList.toggle('active',b.dataset.page===name));
    rotation=index*72; record.style.transform=`rotate(${rotation}deg)`;
    status.innerHTML=`TRACK ${String(index+1).padStart(2,'0')} // ${name.toUpperCase()} COMPONENT <b>TRK ${String(index+1).padStart(2,'0')}</b>`;
    document.body.classList.remove('boot-screen'); if(boot) start?.blur();
  }
  function spin(delta){if(current<0){showPage('home');return}const next=(current+delta+pages.length)%pages.length;showPage(pages[next]);spinning=true;clearTimeout(spin.stop);spin.stop=setTimeout(()=>spinning=false,400)}
  function tick(){if(spinning){rotation+=1.8;record.style.transform=`rotate(${rotation}deg)`;rpm.textContent='33.3'}else rpm.textContent=current<0?'0.0':'33.3';raf=requestAnimationFrame(tick)} tick();

  start?.addEventListener('click',()=>showPage('home',true));
  navButtons.forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));
  document.getElementById('play')?.addEventListener('click',()=>{spinning=!spinning;document.getElementById('play').textContent=spinning?'❚❚ PLAY':'▶ PLAY'});
  document.getElementById('stop')?.addEventListener('click',()=>{spinning=false});
  document.getElementById('prev')?.addEventListener('click',()=>spin(-1));
  document.getElementById('next')?.addEventListener('click',()=>spin(1));
  document.querySelectorAll('.track-row').forEach(row=>row.addEventListener('click',()=>{document.querySelectorAll('.track-row').forEach(r=>r.classList.remove('active'));row.classList.add('active');spinning=true}));
  document.querySelectorAll('.swatch').forEach(s=>s.addEventListener('click',()=>{document.querySelectorAll('.swatch').forEach(x=>x.classList.remove('active'));s.classList.add('active')}));
  document.querySelectorAll('.download-actions .console-btn').forEach((button,i)=>button.addEventListener('click',()=>{if(i===0)return;showPage('home')}));

  let wheel=0;
  document.getElementById('turntable')?.addEventListener('wheel',e=>{e.preventDefault();wheel+=e.deltaY;if(Math.abs(wheel)>55){spin(wheel>0?1:-1);wheel=0}},{passive:false});
  let dragging=false,lastAngle=0;const table=document.getElementById('turntable');
  function angle(e){const r=table.getBoundingClientRect();return Math.atan2(e.clientY-(r.top+r.height/2),e.clientX-(r.left+r.width/2))}
  table?.addEventListener('pointerdown',e=>{dragging=true;lastAngle=angle(e);table.setPointerCapture(e.pointerId)});
  table?.addEventListener('pointermove',e=>{if(!dragging)return;const a=angle(e),diff=a-lastAngle;rotation+=diff*180/Math.PI;record.style.transform=`rotate(${rotation}deg)`;if(Math.abs(diff)>.04)spinning=true;lastAngle=a});
  table?.addEventListener('pointerup',e=>{dragging=false;spinning=false;table.releasePointerCapture(e.pointerId)});
  document.addEventListener('keydown',e=>{if(e.key==='ArrowRight')spin(1);if(e.key==='ArrowLeft')spin(-1);if(e.key==='Enter'&&current<0)showPage('home',true);if(e.key===' '){e.preventDefault();spinning=!spinning}});

  // The console has one real account control so login is reachable from every boot state.
  const topbar=document.querySelector('.topbar');
  if(topbar){const account=document.createElement('a');account.href='login.html';account.textContent='ACCOUNT';account.style.cssText='border:1px solid #151515;padding:4px 8px;font-size:8px;font-weight:700;margin-left:10px;background:#fffdf8';topbar.appendChild(account);
    fetch('/api/auth/me',{credentials:'same-origin'}).then(r=>r.ok?r.json():null).then(data=>{if(!data?.authenticated)return;account.textContent=`ACCOUNT: ${data.user.display_name} / LOGOUT`;account.addEventListener('click',async e=>{e.preventDefault();await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin'});location.reload()},{once:true})}).catch(()=>{});
  }

  document.querySelectorAll('a[href="#"]').forEach(a=>{if(/Download|BOOT DESKTOP/i.test(a.textContent)){a.href='https://github.com/Yukidev-404/MELO-Website/releases';a.target='_blank';a.rel='noopener'}});
  window.addEventListener('beforeunload',()=>cancelAnimationFrame(raf));
})();

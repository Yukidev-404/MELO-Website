(() => {
  if (window.matchMedia('(max-width: 760px)').matches) return;
  if (document.querySelector('.melo-cursor')) return;

  const style = document.createElement('style');
  style.textContent = `
    html.melo-cursor-page, html.melo-cursor-page body { cursor: none !important; }
    html.melo-cursor-page a, html.melo-cursor-page button { cursor: none !important; }
    .melo-cursor { position: fixed; left: 0; top: 0; width: 13px; height: 13px; border: 1.5px solid #171514; border-radius: 50%; pointer-events: none; z-index: 2147483647; transform: translate(-50%,-50%); background: rgba(255,250,242,.72); transition: width .16s,height .16s,background .16s,border-color .16s; mix-blend-mode: multiply; }
    .melo-cursor:after { content:''; position:absolute; width:3px; height:3px; left:50%; top:50%; transform:translate(-50%,-50%); background:#ff3b98; border-radius:50%; }
    .melo-cursor.hover { width:28px; height:28px; border-color:#ff3b98; background:rgba(255,59,152,.08); }
    .melo-cursor.click { width:9px; height:9px; }
  `;
  document.head.appendChild(style);
  document.documentElement.classList.add('melo-cursor-page');

  const cursor = document.createElement('div');
  cursor.className = 'melo-cursor';
  cursor.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cursor);

  let x = -100, y = -100;
  let tx = x, ty = y;
  let visible = false;

  window.addEventListener('mousemove', e => {
    tx = e.clientX; ty = e.clientY; visible = true;
  }, { passive: true });

  window.addEventListener('mouseleave', () => { visible = false; });
  window.addEventListener('mouseenter', () => { visible = true; });

  document.addEventListener('mouseover', e => {
    if (e.target.closest('a,button,[role="button"]')) cursor.classList.add('hover');
  });
  document.addEventListener('mouseout', e => {
    if (e.target.closest('a,button,[role="button"]')) cursor.classList.remove('hover');
  });
  document.addEventListener('mousedown', () => cursor.classList.add('click'));
  document.addEventListener('mouseup', () => cursor.classList.remove('click'));

  const render = () => {
    x += (tx - x) * 0.24;
    y += (ty - y) * 0.24;
    cursor.style.transform = `translate(${x}px,${y}px) translate(-50%,-50%)`;
    cursor.style.opacity = visible ? '1' : '0';
    requestAnimationFrame(render);
  };
  render();
})();

/* MELO public site — use the copied Desktop assets locally */
(() => {
  const asset = name => `assets/${name}`;

  document.querySelectorAll('img[src*="MELO-Desktop/main/assets/"]').forEach(img => {
    const match = img.src.match(/assets\/([^/?#]+)$/);
    if (match) img.src = asset(match[1]);
  });

  const hero = document.querySelector('.hero-art');
  if (hero) {
    const note = hero.querySelector('.real-asset-note');
    if (note) note.textContent = 'MELO DESKTOP / LOCAL ASSETS';
  }

  const showcase = document.querySelector('.screen-stack');
  if (showcase) {
    showcase.innerHTML = `
      <div class="real-screen real-screen-main">
        <img src="${asset('melo-banner.png')}" alt="MELO Desktop artwork">
      </div>
      <div class="real-screen real-screen-detail">
        <img src="${asset('melo_disc_texture_hr.png')}" alt="MELO turntable disc artwork">
      </div>
    `;
  }

  const features = document.querySelector('.features');
  if (features && !features.querySelector('.asset-feature-grid')) {
    const grid = document.createElement('div');
    grid.className = 'asset-feature-grid';
    grid.innerHTML = `
      <div class="asset-chip"><img src="${asset('play_icon.png')}" alt=""><span><strong>PLAY</strong>Custom playback controls</span></div>
      <div class="asset-chip"><img src="${asset('favorite_wave.png')}" alt=""><span><strong>FAVORITES</strong>Made for your library</span></div>
      <div class="asset-chip"><img src="${asset('shuffle_icon.png')}" alt=""><span><strong>SHUFFLE</strong>Listen your way</span></div>
      <div class="asset-chip"><img src="${asset('repeat_bunny.png')}" alt=""><span><strong>REPEAT</strong>Little MELO details</span></div>
    `;
    features.appendChild(grid);
  }
})();

/* MELO public site — real Desktop assets */
(() => {
  const asset = name => `assets/${name}`;

  const hero = document.querySelector('.hero-art');
  if (hero) {
    const backdrop = document.createElement('div');
    backdrop.className = 'asset-backdrop';

    const note = document.createElement('div');
    note.className = 'real-asset-note';
    note.textContent = 'REAL MELO DESKTOP / CURRENT ASSETS';

    const disc = document.createElement('div');
    disc.className = 'asset-disc';

    const arm = document.createElement('img');
    arm.className = 'asset-arm';
    arm.src = asset('melo_tonearm_hr.png');
    arm.alt = '';
    arm.setAttribute('aria-hidden', 'true');

    hero.prepend(backdrop, disc, arm, note);
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
  if (features) {
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

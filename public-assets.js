/* MELO public site — local Desktop asset enhancement */
(() => {
  const asset = name => `assets/${name}`;
  document.querySelectorAll('img[src*="MELO-Desktop/main/assets/"]').forEach(img => {
    const match = img.src.match(/assets\/([^/?#]+)$/);
    if (match) img.src = asset(match[1]);
  });
})();

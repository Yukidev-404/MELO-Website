/* MELO Control Room — Step 9 QA fixes */
(() => {
  const normalizeStatuses = root => {
    (root || document).querySelectorAll('.status-text').forEach(el => {
      const text = el.textContent.trim().toUpperCase();
      const negative = /^(?:INACTIVE|OFF|DOWN|ERROR|FAILED|REVOKED|NOT CONFIGURED|ATTENTION|DEGRADED|UNKNOWN)$/.test(text) || /^(?:NOT\s+)/.test(text);
      if (negative) el.classList.remove('good');
    });
  };
  const content = document.getElementById('page-content');
  if (content) {
    normalizeStatuses(content);
    new MutationObserver(() => normalizeStatuses(content)).observe(content, {childList:true, subtree:true});
  }
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    document.getElementById('detail-modal')?.remove();
    document.getElementById('installation-detail-overlay')?.remove();
    document.getElementById('crash-detail-overlay')?.remove();
    document.getElementById('bug-report-detail-overlay')?.remove();
  });
  new MutationObserver(() => {
    const modal = document.querySelector('#detail-modal .modal');
    if (modal) {
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    }
  }).observe(document.body, {childList:true, subtree:true});
})();

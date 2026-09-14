(() => {
  const identity = document.getElementById('identity');
  if (!identity) return;
  fetch('/api/admin/me', { credentials: 'include', cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => { if (d?.username) identity.textContent = d.username; })
    .catch(() => {});
})();

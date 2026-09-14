(() => {
  const identity = document.getElementById('identity');
  const info = document.querySelector('.admin-info');
  const nav = document.querySelector('aside.sidebar nav');
  if (!identity) return;

  fetch('/api/admin/me', { credentials: 'include', cache: 'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d?.username) return;
      identity.textContent = d.username;
      const label = info?.querySelector('strong');
      if (label) label.textContent = d.role === 'owner' ? 'Owner' : 'Admin';

      if (d.role !== 'owner' || d.username !== 'Yuki' || !nav || nav.querySelector('[data-owner-admins]')) return;
      const section = document.createElement('p');
      section.className = 'nav-label';
      section.textContent = 'MANAGEMENT';
      section.dataset.ownerAdmins = 'label';
      const item = document.createElement('a');
      item.className = 'nav-item';
      item.href = '/admin/administrators.html';
      item.dataset.ownerAdmins = 'item';
      item.innerHTML = '<span>◎</span>Administrators';
      nav.append(section, item);
    })
    .catch(() => {});
})();

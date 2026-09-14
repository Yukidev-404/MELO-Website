(() => {
  const identity = document.getElementById('identity');
  const info = document.querySelector('.admin-info');
  const avatar = document.querySelector('.admin-avatar');
  const sessionLabel = info?.querySelector('small');
  const nav = document.querySelector('aside.sidebar nav');
  if (!identity) return;

  fetch('/api/admin/me', { credentials:'include', cache:'no-store' })
    .then(r => r.ok ? r.json() : null)
    .then(d => {
      if (!d?.username) return;
      identity.textContent = d.username;
      const label = info?.querySelector('strong');
      if (label) label.textContent = d.role === 'owner' ? 'Owner' : 'Admin';
      if (avatar) {
        const letters = String(d.username).trim().split(/\s+/).map(x => x[0]).join('').slice(0,2).toUpperCase();
        avatar.textContent = letters || 'ME';
        avatar.title = `${d.username} · ${d.role === 'owner' ? 'Owner' : 'Admin'}`;
      }
      if (sessionLabel && d.expiresAt) {
        const update = () => {
          const seconds = Math.max(0, Number(d.expiresAt) - Math.floor(Date.now()/1000));
          const hours = Math.floor(seconds / 3600);
          const mins = Math.floor((seconds % 3600) / 60);
          sessionLabel.innerHTML = `<i></i> SESSION · ${hours}H ${String(mins).padStart(2,'0')}M`;
          sessionLabel.title = `Session expires in ${hours}h ${mins}m`;
        };
        update();
        setInterval(update, 60000);
      }

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

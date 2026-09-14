(() => {
  const button = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  if (!button || !sidebar || !content) return;

  const STORAGE_KEY = 'melo_control_room_sidebar_collapsed';
  const desktop = () => window.innerWidth > 760;

  const setCollapsed = (collapsed, save = true) => {
    if (!desktop()) return;
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    if (save) localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  };

  const saved = localStorage.getItem(STORAGE_KEY) === '1';
  if (desktop()) setCollapsed(saved, false);

  button.addEventListener('click', () => {
    setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  });

  document.addEventListener('keydown', (event) => {
    if (!desktop()) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    }
  });

  window.addEventListener('resize', () => {
    if (!desktop()) document.body.classList.remove('sidebar-collapsed');
    else setCollapsed(localStorage.getItem(STORAGE_KEY) === '1', false);
  });
})();

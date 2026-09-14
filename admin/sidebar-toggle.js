(() => {
  const button = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  if (!button || !sidebar || !content) return;

  const STORAGE_KEY = 'melo_control_room_sidebar_collapsed';
  const desktop = () => window.innerWidth > 760;

  // Give every sidebar item a clean label and build the tooltip outside the
  // sidebar so it can never be clipped by the collapsed rail's overflow.
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    const label = Array.from(item.childNodes)
      .filter(node => node.nodeType === Node.TEXT_NODE)
      .map(node => node.textContent.trim())
      .filter(Boolean)
      .join(' ')
      || item.getAttribute('aria-label')
      || item.textContent.replace(/\s+/g, ' ').trim();
    if (!label) return;

    item.dataset.tooltip = label;
    item.setAttribute('aria-label', label);

    item.addEventListener('mouseenter', () => {
      if (!document.body.classList.contains('sidebar-collapsed') || !desktop()) return;
      showTooltip(item, label);
    });
    item.addEventListener('mouseleave', hideTooltip);
  });

  let tooltip = null;
  function showTooltip(item, label) {
    hideTooltip();
    tooltip = document.createElement('div');
    tooltip.className = 'melo-sidebar-tooltip';
    tooltip.textContent = label;
    tooltip.setAttribute('role', 'tooltip');
    document.body.appendChild(tooltip);
    const rect = item.getBoundingClientRect();
    tooltip.style.left = `${Math.round(rect.right + 10)}px`;
    tooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
    requestAnimationFrame(() => tooltip?.classList.add('visible'));
  }
  function hideTooltip() {
    if (!tooltip) return;
    tooltip.remove();
    tooltip = null;
  }

  const setCollapsed = (collapsed, save = true) => {
    if (!desktop()) return;
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    if (!collapsed) hideTooltip();
    if (save) localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  };

  const saved = localStorage.getItem(STORAGE_KEY) === '1';
  if (desktop()) setCollapsed(saved, false);

  button.addEventListener('click', () => {
    setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
  });

  document.addEventListener('keydown', event => {
    if (!desktop()) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      setCollapsed(!document.body.classList.contains('sidebar-collapsed'));
    }
  });

  window.addEventListener('resize', () => {
    hideTooltip();
    if (!desktop()) document.body.classList.remove('sidebar-collapsed');
    else setCollapsed(localStorage.getItem(STORAGE_KEY) === '1', false);
  });
})();

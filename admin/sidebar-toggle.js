(() => {
  const button = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const content = document.querySelector('.content');
  if (!button || !sidebar || !content) return;

  const STORAGE_KEY = 'melo_control_room_sidebar_collapsed';
  const desktop = () => window.innerWidth > 760;
  let tooltip = null;
  let hoveredItem = null;

  function getLabel(item) {
    return item.dataset.tooltip
      || Array.from(item.childNodes).filter(n => n.nodeType === Node.TEXT_NODE)
        .map(n => n.textContent.trim()).filter(Boolean).join(' ')
      || item.getAttribute('aria-label')
      || item.textContent.replace(/\s+/g, ' ').trim();
  }

  function showTooltip(item) {
    if (!document.body.classList.contains('sidebar-collapsed') || !desktop()) return;
    const label = getLabel(item);
    if (!label) return;
    hoveredItem = item;
    hideTooltip();
    hoveredItem = item;
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
    if (tooltip) tooltip.remove();
    tooltip = null;
  }

  // Event delegation is intentional: Administrators is injected later for
  // the Owner account, so it must receive the same hover behavior as static tabs.
  sidebar.addEventListener('mouseover', event => {
    const item = event.target.closest?.('.nav-item');
    if (!item || !sidebar.contains(item)) return;
    if (item === hoveredItem && tooltip) return;
    showTooltip(item);
  });
  sidebar.addEventListener('mouseout', event => {
    const item = event.target.closest?.('.nav-item');
    const next = event.relatedTarget?.closest?.('.nav-item');
    if (item && item !== next) {
      hoveredItem = null;
      hideTooltip();
    }
  });

  // Stamp labels onto current items. Dynamically added items are handled by
  // getLabel() through the delegated hover listeners above.
  sidebar.querySelectorAll('.nav-item').forEach(item => {
    const label = getLabel(item);
    if (label) {
      item.dataset.tooltip = label;
      item.setAttribute('aria-label', label);
    }
  });

  const setCollapsed = (collapsed, save = true) => {
    if (!desktop()) return;
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    button.setAttribute('aria-expanded', String(!collapsed));
    button.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
    button.title = collapsed ? 'Expand sidebar' : 'Collapse sidebar';
    if (!collapsed) hideTooltip();
    if (save) localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  };

  if (desktop()) setCollapsed(localStorage.getItem(STORAGE_KEY) === '1', false);

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
    hoveredItem = null;
    if (!desktop()) document.body.classList.remove('sidebar-collapsed');
    else setCollapsed(localStorage.getItem(STORAGE_KEY) === '1', false);
  });
})();

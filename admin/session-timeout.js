(() => {
  const TIMEOUT_MS = 30 * 60 * 1000;
  const WARNING_MS = 60 * 1000;
  const KEY = 'melo_admin_last_activity';
  let warningTimer = null;
  let logoutTimer = null;
  let warning = null;

  const touch = () => {
    const now = Date.now();
    localStorage.setItem(KEY, String(now));
    schedule(now);
  };

  const logout = async () => {
    try {
      await fetch('/api/admin/logout', {method:'POST', credentials:'include', cache:'no-store'});
    } finally {
      localStorage.removeItem(KEY);
      location.href = '../admin-login.html?reason=inactivity';
    }
  };

  const closeWarning = () => {
    if (warning) warning.remove();
    warning = null;
  };

  const showWarning = () => {
    closeWarning();
    warning = document.createElement('div');
    warning.className = 'melo-session-warning';
    warning.innerHTML = '<div><strong>SESSION INACTIVE</strong><span>You will be signed out in <b id="melo-session-countdown">60</b> seconds.</span></div><button type="button">STAY SIGNED IN</button>';
    document.body.appendChild(warning);
    warning.querySelector('button').addEventListener('click', () => { closeWarning(); touch(); });
    let remaining = 60;
    const countdown = warning.querySelector('#melo-session-countdown');
    const timer = setInterval(() => {
      remaining -= 1;
      if (!warning || !document.body.contains(warning)) { clearInterval(timer); return; }
      countdown.textContent = String(Math.max(0, remaining));
      if (remaining <= 0) clearInterval(timer);
    }, 1000);
  };

  const schedule = (last) => {
    clearTimeout(warningTimer); clearTimeout(logoutTimer);
    closeWarning();
    const elapsed = Date.now() - Number(last || Date.now());
    const remaining = TIMEOUT_MS - elapsed;
    if (remaining <= 0) { logout(); return; }
    warningTimer = setTimeout(showWarning, Math.max(0, remaining - WARNING_MS));
    logoutTimer = setTimeout(logout, remaining);
  };

  ['pointerdown','keydown','wheel','touchstart'].forEach(type => document.addEventListener(type, touch, {passive:true}));
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(Number(localStorage.getItem(KEY) || Date.now())); });
  window.addEventListener('storage', e => { if (e.key === KEY) schedule(Number(e.newValue || Date.now())); });

  const initial = Number(localStorage.getItem(KEY) || 0);
  if (!initial || Date.now() - initial >= TIMEOUT_MS) touch();
  else schedule(initial);
})();

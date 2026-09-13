const identity = document.getElementById('identity');
const session = document.getElementById('session');
const logout = document.getElementById('logout');

async function load() {
  const response = await fetch('/api/admin/me', { credentials: 'include', cache: 'no-store' });
  if (!response.ok) {
    window.location.href = '../admin-login.html';
    return;
  }
  const data = await response.json();
  identity.textContent = `Signed in as ${data.email}`;
  session.textContent = `Session expires ${new Date(data.expiresAt * 1000).toLocaleString()}`;
}

logout.addEventListener('click', async () => {
  logout.disabled = true;
  await fetch('/api/admin/logout', { method: 'POST', credentials: 'include' });
  window.location.href = '../admin-login.html';
});

load().catch(() => { window.location.href = '../admin-login.html'; });

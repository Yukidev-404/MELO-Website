const form = document.getElementById('adminLoginForm');
const message = document.getElementById('adminMessage');
const submit = form.querySelector('.submit');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;

  const email = document.getElementById('adminEmail').value.trim();
  const password = document.getElementById('adminPassword').value;
  const remember = document.getElementById('rememberAdmin').checked;

  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-MELO-Client': 'admin-console'
      },
      body: JSON.stringify({ email, password, remember })
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(data.error || 'Admin sign-in failed.');
    }

    window.location.href = data.redirect || 'admin/';
  } catch (error) {
    message.textContent = error.message || 'Unable to reach the admin authentication service.';
  } finally {
    submit.disabled = false;
  }
});

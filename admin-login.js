const form = document.getElementById('adminLoginForm');
const message = document.getElementById('adminMessage');
const submit = document.getElementById('submitButton');
const emailInput = document.getElementById('adminEmail');
const totpSetup = document.getElementById('totpSetup');
const totpQr = document.getElementById('totpQr');
const setupKey = document.getElementById('setupKey');
const totpCode = document.getElementById('totpCode');
const intro = document.getElementById('adminIntro');
const steps = document.querySelectorAll('#setupSteps span');
let setupStarted = false;

function showStep(step) {
  steps.forEach((item, index) => item.classList.toggle('active', index <= step));
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;

  const email = emailInput.value.trim().toLowerCase();

  try {
    if (!setupStarted) {
      const response = await fetch('/api/admin/setup/start', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console' },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to start authenticator setup.');

      totpQr.src = data.qrCodeDataUrl;
      setupKey.value = data.setupKey;
      totpSetup.hidden = false;
      setupStarted = true;
      emailInput.readOnly = true;
      intro.textContent = 'Scan the QR code with your authenticator app, then enter the 6-digit code it generates.';
      submit.innerHTML = 'Verify authenticator <span>→</span>';
      totpCode.required = true;
      showStep(1);
      message.textContent = 'Setup started. Add MELO Admin to your authenticator app.';
      return;
    }

    const code = totpCode.value.trim();
    if (!/^\d{6}$/.test(code)) throw new Error('Enter the current 6-digit Authenticator code.');

    const response = await fetch('/api/admin/setup/verify', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console' },
      body: JSON.stringify({ email, code })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Authenticator verification failed.');

    window.location.href = data.redirect || '/admin/';
  } catch (error) {
    message.textContent = error.message || 'Unable to reach the admin authentication service.';
  } finally {
    submit.disabled = false;
  }
});

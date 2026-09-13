const form = document.getElementById('adminLoginForm');
const message = document.getElementById('adminMessage');
const submit = document.getElementById('submitButton');
const emailInput = document.getElementById('adminEmail');
const setupTokenWrap = document.getElementById('setupTokenWrap');
const setupToken = document.getElementById('setupToken');
const totpSetup = document.getElementById('totpSetup');
const totpQr = document.getElementById('totpQr');
const setupKey = document.getElementById('setupKey');
const totpCode = document.getElementById('totpCode');
const intro = document.getElementById('adminIntro');
const steps = document.querySelectorAll('#setupSteps span');
let setupStarted = false;
let configured = false;

function showStep(step) {
  steps.forEach((item, index) => item.classList.toggle('active', index <= step));
}

function setMode(isConfigured) {
  configured = isConfigured;
  setupTokenWrap.hidden = isConfigured || setupStarted;
  document.querySelector('#setupSteps').hidden = isConfigured;
  if (isConfigured) {
    intro.textContent = 'Enter your administrator email and current 6-digit Authenticator code.';
    submit.innerHTML = 'Sign in <span>→</span>';
    totpSetup.hidden = false;
    setupKey.parentElement.hidden = true;
    document.querySelector('.setup-panel').querySelector('strong').textContent = 'AUTHENTICATOR';
    document.querySelector('.setup-panel').querySelector('p').textContent = 'Enter the current code from your authenticator app.';
    document.querySelector('.qr-wrap').hidden = true;
    document.querySelector('.warning').hidden = true;
    showStep(2);
  } else {
    intro.textContent = 'First-time setup: enter the authorized administrator email and one-time setup key.';
    setupTokenWrap.hidden = false;
    totpSetup.hidden = setupStarted ? false : true;
    submit.innerHTML = setupStarted ? 'Verify authenticator <span>→</span>' : 'Continue <span>→</span>';
    showStep(setupStarted ? 1 : 0);
  }
}

async function checkStatus() {
  try {
    const response = await fetch('/api/admin/status', { credentials: 'include', cache: 'no-store' });
    const data = await response.json();
    setMode(Boolean(data.configured));
  } catch {
    intro.textContent = 'Unable to reach the MELO admin service.';
  }
}

checkStatus();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;
  const email = emailInput.value.trim().toLowerCase();

  try {
    if (configured) {
      const code = totpCode.value.trim();
      if (!/^\d{6}$/.test(code)) throw new Error('Enter the current 6-digit Authenticator code.');
      const response = await fetch('/api/admin/login', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console' },
        body: JSON.stringify({ email, code })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Login failed.');
      window.location.href = data.redirect || '/admin/';
      return;
    }

    if (!setupStarted) {
      const token = setupToken.value.trim();
      if (!token) throw new Error('Enter the one-time setup key.');
      const response = await fetch('/api/admin/setup/start', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console', 'X-MELO-Setup-Token': token },
        body: JSON.stringify({ email })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'Unable to start authenticator setup.');
      totpQr.src = data.qrCodeDataUrl;
      setupKey.value = data.setupKey;
      totpSetup.hidden = false;
      setupStarted = true;
      setupTokenWrap.hidden = true;
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
      method: 'POST', credentials: 'include',
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

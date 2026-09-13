const form = document.getElementById('adminLoginForm');
const message = document.getElementById('adminMessage');
const submit = document.getElementById('submitButton');
const emailInput = document.getElementById('adminEmail');
const setupTokenWrap = document.getElementById('setupTokenWrap');
const setupToken = document.getElementById('setupToken');
const totpSetup = document.getElementById('totpSetup');
const setupPanel = document.querySelector('.setup-panel');
const totpQr = document.getElementById('totpQr');
const setupKey = document.getElementById('setupKey');
const totpCode = document.getElementById('totpCode');
const intro = document.getElementById('adminIntro');
const steps = document.querySelectorAll('#setupSteps span');
const emailStatus = document.getElementById('emailStatus');

const ADMIN_EMAIL = 'tajtaranga@gmail.com';
let setupStarted = false;
let configured = false;

function showStep(step) {
  steps.forEach((item, index) => item.classList.toggle('active', index <= step));
}

function resetAuthFields() {
  setupStarted = false;
  setupToken.value = '';
  totpCode.value = '';
  setupKey.value = '';
  totpQr.removeAttribute('src');
  setupTokenWrap.hidden = true;
  totpSetup.hidden = true;
  setupPanel.hidden = false;
  emailInput.readOnly = false;
  submit.disabled = false;
  submit.innerHTML = 'Continue <span>→</span>';
  emailStatus.textContent = '';
  emailStatus.className = 'email-status';
  showStep(0);
}

function setEmailStatus(type, text) {
  emailStatus.textContent = text;
  emailStatus.className = `email-status ${type}`;
}

function checkEmailState() {
  const email = emailInput.value.trim().toLowerCase();
  resetAuthFields();

  if (!email) return;

  if (email !== ADMIN_EMAIL) {
    setEmailStatus('invalid', 'ADMIN EMAIL NOT RECOGNIZED');
    intro.textContent = 'Enter the configured administrator email to continue.';
    submit.disabled = true;
    return;
  }

  setEmailStatus('valid', '✓ ADMIN EMAIL VERIFIED');
  submit.disabled = false;

  if (configured) {
    intro.textContent = 'Administrator recognized. Enter the current 6-digit Authenticator code.';
    totpSetup.hidden = false;
    setupPanel.hidden = true;
    totpCode.required = true;
    submit.innerHTML = 'Sign in <span>→</span>';
    showStep(2);
  } else {
    intro.textContent = 'First-time setup: enter the one-time Cloudflare setup key.';
    setupTokenWrap.hidden = false;
    submit.innerHTML = 'Continue <span>→</span>';
    showStep(0);
  }
}

async function checkStatus() {
  try {
    const response = await fetch('/api/admin/status', { credentials: 'include', cache: 'no-store' });
    const data = await response.json();
    configured = Boolean(data.configured);
    resetAuthFields();
    intro.textContent = configured
      ? 'Enter your administrator email to continue.'
      : 'First-time setup: enter your administrator email to begin.';
    submit.disabled = true;
    checkEmailState();
  } catch {
    intro.textContent = 'Unable to reach the MELO admin service.';
    submit.disabled = true;
  }
}

emailInput.addEventListener('input', checkEmailState);
emailInput.addEventListener('blur', checkEmailState);
checkStatus();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;
  const email = emailInput.value.trim().toLowerCase();

  try {
    if (email !== ADMIN_EMAIL) throw new Error('Enter the configured administrator email.');

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
      setupPanel.hidden = false;
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
    if (!emailInput.readOnly) submit.disabled = emailInput.value.trim().toLowerCase() !== ADMIN_EMAIL;
    else submit.disabled = false;
  }
});

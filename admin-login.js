const form = document.getElementById('adminLoginForm');
const message = document.getElementById('adminMessage');
const submit = document.getElementById('submitButton');
const usernameInput = document.getElementById('adminUsername');
const emailWrap = document.getElementById('emailWrap');
const emailInput = document.getElementById('adminEmail');
const setupTokenWrap = document.getElementById('setupTokenWrap');
const setupToken = document.getElementById('setupToken');
const totpSetup = document.getElementById('totpSetup');
const normalTotp = document.getElementById('normalTotp');
const totpQr = document.getElementById('totpQr');
const setupKey = document.getElementById('setupKey');
const totpCode = document.getElementById('totpCode');
const normalTotpCode = document.getElementById('normalTotpCode');
const intro = document.getElementById('adminIntro');
const steps = document.querySelectorAll('#setupSteps span');

let configured = false;
let setupStarted = false;

// Keep browser-native validation from silently blocking the submit handler.
// All validation is performed explicitly below so the user always gets a visible MELO error.
form.noValidate = true;

function showStep(step) {
  steps.forEach((item, index) => item.classList.toggle('active', index <= step));
}

function validUsername() {
  return /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/.test(usernameInput.value.trim());
}

function validCode(value) {
  return /^\d{6}$/.test(String(value || '').trim());
}

function resetSetupFields() {
  setupStarted = false;
  emailInput.value = '';
  setupToken.value = '';
  totpCode.value = '';
  normalTotpCode.value = '';
  setupKey.value = '';
  totpQr.removeAttribute('src');
  emailWrap.hidden = configured;
  setupTokenWrap.hidden = configured;
  totpSetup.hidden = true;
  normalTotp.hidden = !configured;
  usernameInput.readOnly = false;
  submit.disabled = false;
  submit.innerHTML = configured ? 'Sign in <span>→</span>' : 'Continue <span>→</span>';
  showStep(configured ? 2 : 0);
}

async function requestJson(path, options = {}) {
  let response;
  try {
    response = await fetch(path, { credentials: 'include', cache: 'no-store', ...options });
  } catch {
    throw new Error('Unable to reach the MELO admin service. Check your connection and try again.');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status}).`);
  return data;
}

async function checkStatus() {
  try {
    const data = await requestJson('/api/admin/status');
    configured = Boolean(data.configured);
    resetSetupFields();
    intro.textContent = configured
      ? 'Enter your administrator username and current Authenticator code.'
      : 'First-time setup: create the administrator identity and Authenticator.';
    usernameInput.placeholder = 'your username';
    submit.disabled = false;
  } catch (error) {
    intro.textContent = 'Unable to reach the MELO admin service.';
    message.textContent = error.message;
    submit.disabled = true;
  }
}

usernameInput.addEventListener('input', () => {
  usernameInput.setCustomValidity(validUsername() ? '' : 'Use 3–32 letters, numbers, underscores or hyphens.');
});

normalTotpCode?.addEventListener('input', () => {
  normalTotpCode.value = normalTotpCode.value.replace(/\D/g, '').slice(0, 6);
});

totpCode?.addEventListener('input', () => {
  totpCode.value = totpCode.value.replace(/\D/g, '').slice(0, 6);
});

checkStatus();

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  message.textContent = '';
  submit.disabled = true;

  const username = usernameInput.value.trim();

  try {
    if (!validUsername()) throw new Error('Enter a valid administrator username.');

    if (configured) {
      const code = normalTotpCode.value.trim();
      if (!validCode(code)) throw new Error('Enter the current 6-digit Authenticator code.');

      const data = await requestJson('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console' },
        body: JSON.stringify({ username, code })
      });

      window.location.href = data.redirect || '/admin/';
      return;
    }

    if (!setupStarted) {
      const email = emailInput.value.trim().toLowerCase();
      const token = setupToken.value.trim();
      if (!email) throw new Error('Enter the administrator email address.');
      if (!token) throw new Error('Enter the one-time setup key.');

      const data = await requestJson('/api/admin/setup/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MELO-Client': 'admin-console',
          'X-MELO-Setup-Token': token
        },
        body: JSON.stringify({ username, email })
      });

      totpQr.src = data.qrCodeDataUrl;
      setupKey.value = data.setupKey;
      totpSetup.hidden = false;
      setupStarted = true;
      emailWrap.hidden = true;
      setupTokenWrap.hidden = true;
      usernameInput.readOnly = true;
      intro.textContent = 'Scan the QR code with your authenticator app, then enter the 6-digit code it generates.';
      submit.innerHTML = 'Verify authenticator <span>→</span>';
      showStep(1);
      message.textContent = 'Setup started. Add MELO Admin to your authenticator app.';
      return;
    }

    const code = totpCode.value.trim();
    if (!validCode(code)) throw new Error('Enter the current 6-digit Authenticator code.');

    const data = await requestJson('/api/admin/setup/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-MELO-Client': 'admin-console' },
      body: JSON.stringify({ username, email: emailInput.value.trim().toLowerCase(), code })
    });

    window.location.href = data.redirect || '/admin/';
  } catch (error) {
    message.textContent = error.message || 'Unable to reach the admin authentication service.';
  } finally {
    submit.disabled = false;
  }
});

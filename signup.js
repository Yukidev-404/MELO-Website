const API_BASE = 'https://melo-website.tajtaranga.workers.dev';
const form = document.getElementById('signupForm');
const message = document.getElementById('signupMessage');
const signupPanel = document.getElementById('signupPanel');
const verifyPanel = document.getElementById('verifyPanel');
const verifyForm = document.getElementById('verifyForm');
const verifyEmail = document.getElementById('verifyEmail');
const verificationCode = document.getElementById('verificationCode');
const resendButton = document.getElementById('resendCode');
const changeEmail = document.getElementById('changeEmail');
let pendingEmail = '';

async function post(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function showVerification(email) {
  pendingEmail = email;
  verifyEmail.textContent = email;
  signupPanel.style.display = 'none';
  verifyPanel.style.display = 'block';
  message.textContent = 'Check your inbox for the verification code.';
  verificationCode.focus();
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirm').value;
  if (password !== confirm) {
    message.textContent = 'Passwords do not match.';
    return;
  }
  const submit = form.querySelector('.submit');
  const email = document.getElementById('email').value.trim().toLowerCase();
  submit.disabled = true;
  message.textContent = 'Sending your verification code…';
  try {
    const data = await post('/api/auth/signup', {
      name: document.getElementById('name').value,
      email,
      password
    });
    if (!data.verification_required) throw new Error('Verification is required before your account can be created.');
    showVerification(data.email || email);
  } catch (error) {
    message.textContent = error.message;
  } finally {
    submit.disabled = false;
  }
});

verifyForm.addEventListener('submit', async e => {
  e.preventDefault();
  const submit = verifyForm.querySelector('.submit');
  submit.disabled = true;
  message.textContent = 'Verifying your email…';
  try {
    const data = await post('/api/auth/verify-email', {
      email: pendingEmail,
      code: verificationCode.value.trim()
    });
    message.textContent = `Welcome to MELO, ${data.user.display_name}. Redirecting…`;
    setTimeout(() => { window.location.href = 'index.html'; }, 600);
  } catch (error) {
    message.textContent = error.message;
    verificationCode.select();
  } finally {
    submit.disabled = false;
  }
});

resendButton.addEventListener('click', async () => {
  resendButton.disabled = true;
  message.textContent = 'Sending a new code…';
  try {
    await post('/api/auth/resend-code', { email: pendingEmail });
    message.textContent = 'A new verification code was sent. It expires in 10 minutes.';
    verificationCode.focus();
  } catch (error) {
    message.textContent = error.message;
  } finally {
    setTimeout(() => { resendButton.disabled = false; }, 1000);
  }
});

changeEmail.addEventListener('click', () => {
  pendingEmail = '';
  verifyPanel.style.display = 'none';
  signupPanel.style.display = 'block';
  message.textContent = '';
  document.getElementById('email').focus();
});

const API_BASE = 'https://melo-website.tajtaranga.workers.dev';
const modes=document.querySelectorAll('.mode');
const form=document.getElementById('loginForm');
const message=document.getElementById('demoMessage');
const card=document.getElementById('loginCard');
const accountLabel=document.getElementById('accountLabel');
const loginIntro=document.getElementById('loginIntro');
const rememberLabel=document.getElementById('rememberLabel');
const forgotLink=document.getElementById('forgotLink');
const socialSection=document.getElementById('socialSection');
const accountFooter=document.getElementById('accountFooter');
const requestedReturn=new URLSearchParams(location.search).get('return')||'';
const returnTarget=/^[A-Za-z0-9_./-]+$/.test(requestedReturn)&&requestedReturn.endsWith('.html')?requestedReturn:'index.html';
let mode='user';

function setMode(nextMode){
  mode=nextMode;
  modes.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const admin=mode==='admin';
  card.classList.toggle('admin-mode',admin);
  accountLabel.textContent=admin?'[ ADMIN CONSOLE ]':'[ MELO ACCOUNT ]';
  loginIntro.textContent=admin?'Authorized MELO administrator access only.':'Sign in to your MELO account.';
  rememberLabel.textContent=admin?'Keep me signed in':'Remember me';
  forgotLink.textContent=admin?'Admin password recovery is handled separately.':'Forgot password?';
  socialSection.hidden=admin;
  accountFooter.hidden=admin;
  message.textContent=admin?'Use the dedicated secure admin login':'';
}

modes.forEach(btn=>btn.addEventListener('click',()=>{
  if(btn.dataset.mode==='admin'){
    window.location.href='admin-login.html';
    return;
  }
  setMode('user');
}));

form.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=form.querySelector('.submit');
  submit.disabled=true;
  message.textContent='Authenticating…';
  try{
    const response=await fetch(`${API_BASE}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},credentials:'include',body:JSON.stringify({email:document.getElementById('email').value,password:document.getElementById('password').value})});
    const data=await response.json().catch(()=>({}));
    if(!response.ok) throw new Error(data.error||'Login failed.');
    message.textContent=`Welcome back, ${data.user.display_name}. Redirecting…`;
    setTimeout(()=>window.location.href=returnTarget,500);
  }catch(error){
    message.textContent=error.message;
  }finally{submit.disabled=false;}
});

forgotLink.addEventListener('click',e=>{
  e.preventDefault();
  window.location.href='forgot-password.html';
});

document.querySelectorAll('.social-login').forEach(button=>button.addEventListener('click',()=>{
  const provider=String(button.dataset.provider||'').toLowerCase();
  if(!provider) return;
  message.textContent=`Connecting to ${button.dataset.provider}…`;
  window.location.href=`${API_BASE}/api/auth/oauth/${provider}`;
}));

setMode('user');

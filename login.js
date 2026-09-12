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
let mode='user';

function setMode(nextMode){
  mode=nextMode;
  modes.forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  const admin=mode==='admin';
  card.classList.toggle('admin-mode',admin);
  accountLabel.textContent=admin?'[ ADMIN CONSOLE ]':'[ MELO ACCOUNT ]';
  loginIntro.textContent=admin?'Authorized MELO administrator access only.':'Sign in to your MELO account.';
  rememberLabel.textContent=admin?'Keep me signed in':'Remember me';
  forgotLink.textContent=admin?'Forgot admin password?':'Forgot password?';
  socialSection.hidden=admin;
  accountFooter.hidden=admin;
  message.textContent=admin?'Admin access uses your MELO administrator email and password.':' ';
}

modes.forEach(btn=>btn.addEventListener('click',()=>setMode(btn.dataset.mode)));

form.addEventListener('submit',e=>{
  e.preventDefault();
  message.textContent=mode==='admin'
    ?'Admin authentication will be connected securely later.'
    :'Account authentication will be connected later.';
});

document.querySelectorAll('.social-login').forEach(button=>button.addEventListener('click',()=>{
  if(mode==='admin') return;
  message.textContent=`${button.dataset.provider} authentication will be connected later.`;
}));

setMode('user');

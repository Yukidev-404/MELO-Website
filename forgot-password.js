const API_BASE='https://melo-website.tajtaranga.workers.dev';
const requestPanel=document.getElementById('requestPanel');
const resetPanel=document.getElementById('resetPanel');
const requestForm=document.getElementById('requestForm');
const resetForm=document.getElementById('resetForm');
const emailInput=document.getElementById('email');
const codeInput=document.getElementById('code');
const passwordInput=document.getElementById('password');
const confirmInput=document.getElementById('confirm');
const message=document.getElementById('message');
const resend=document.getElementById('resend');
const changeEmail=document.getElementById('changeEmail');
let pendingEmail='';

async function post(path,body){
  const response=await fetch(`${API_BASE}${path}`,{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    credentials:'include',
    body:JSON.stringify(body)
  });
  const data=await response.json().catch(()=>({}));
  if(!response.ok) throw new Error(data.error||'Something went wrong.');
  return data;
}

function showReset(email){
  pendingEmail=email;
  requestPanel.style.display='none';
  resetPanel.style.display='block';
  message.textContent='Check your inbox for the reset code. It expires in 10 minutes.';
  codeInput.focus();
}

requestForm.addEventListener('submit',async e=>{
  e.preventDefault();
  const submit=requestForm.querySelector('.submit');
  const email=emailInput.value.trim().toLowerCase();
  submit.disabled=true;
  message.textContent='Sending reset code…';
  try{
    const data=await post('/api/auth/forgot-password',{email});
    if(data.ok) showReset(email);
  }catch(error){
    message.textContent=error.message;
  }finally{
    submit.disabled=false;
  }
});

resetForm.addEventListener('submit',async e=>{
  e.preventDefault();
  if(passwordInput.value!==confirmInput.value){
    message.textContent='Passwords do not match.';
    return;
  }
  const submit=resetForm.querySelector('.submit');
  submit.disabled=true;
  message.textContent='Resetting your password…';
  try{
    await post('/api/auth/reset-password',{
      email:pendingEmail,
      code:codeInput.value.trim(),
      password:passwordInput.value
    });
    message.textContent='Password reset successfully. Redirecting…';
    setTimeout(()=>{window.location.href='login.html';},700);
  }catch(error){
    message.textContent=error.message;
    codeInput.select();
  }finally{
    submit.disabled=false;
  }
});

resend.addEventListener('click',async()=>{
  resend.disabled=true;
  message.textContent='Sending a new reset code…';
  try{
    await post('/api/auth/forgot-password',{email:pendingEmail});
    message.textContent='A new reset code was sent. It expires in 10 minutes.';
    codeInput.focus();
  }catch(error){
    message.textContent=error.message;
  }finally{
    setTimeout(()=>{resend.disabled=false;},1000);
  }
});

changeEmail.addEventListener('click',()=>{
  pendingEmail='';
  resetPanel.style.display='none';
  requestPanel.style.display='block';
  message.textContent='';
  emailInput.focus();
});

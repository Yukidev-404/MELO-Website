(()=>{
const API='https://melo-website.tajtaranga.workers.dev';
const box=document.getElementById('homeAccount');
if(!box)return;
const avatar=document.getElementById('homeAccountAvatar');
const name=document.getElementById('homeAccountName');
const email=document.getElementById('homeAccountEmail');
const provider=document.getElementById('homeAccountProvider');
const action=document.getElementById('homeAccountAction');
const esc=v=>String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
function providerName(user){
 const raw=user?.provider||user?.oauth_provider||user?.auth_provider||user?.identity_provider||user?.login_provider||user?.connection?.provider;
 if(raw)return String(raw).replace(/[_-]+/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
 const list=user?.providers||user?.identities||user?.connections;
 if(Array.isArray(list)&&list.length)return list.map(x=>x?.provider||x?.name||x).filter(Boolean).map(x=>String(x).replace(/[_-]+/g,' ').replace(/\b\w/g,y=>y.toUpperCase())).join(' · ');
 return user?.email?'MELO ACCOUNT':'MELO ACCOUNT';
}
async function load(){
 try{
  const r=await fetch(`${API}/api/auth/me`,{credentials:'include',cache:'no-store'});const data=await r.json().catch(()=>({}));
  if(!r.ok||!data.authenticated||!data.user){box.classList.add('logged-out');name.textContent='NOT CONNECTED';email.textContent='SIGN IN TO MELO';provider.textContent='No account connected';action.textContent='SIGN IN →';action.href='login.html';return}
  const u=data.user;box.classList.add('connected');name.textContent=u.display_name||u.username||u.name||u.email?.split('@')[0]||'MELO PLAYER';email.textContent=u.email||u.username||'MELO ACCOUNT';provider.textContent=`CONNECTED VIA ${providerName(u).toUpperCase()}`;action.textContent='ACCOUNT SETTINGS →';action.href='account-settings.html';
  if(u.avatar_url||u.avatar||u.picture){avatar.src=u.avatar_url||u.avatar||u.picture;avatar.alt='Account avatar';avatar.onerror=()=>{avatar.src='assets/melo-cat.png?v=20260915-2'}}
 }catch(e){box.classList.add('logged-out');name.textContent='ACCOUNT OFFLINE';email.textContent='TRY AGAIN';provider.textContent='Could not check connection';action.textContent='SIGN IN →';action.href='login.html'}
}
load();window.addEventListener('pageshow',load);
})();
(()=>{
const API='https://melo-website.tajtaranga.workers.dev';
const $=id=>document.getElementById(id);
const fields=['displayName','handle','bio','pronouns','country'];let original={};
const pageParams=new URLSearchParams(location.search);
if(pageParams.get('moved')==='1')setTimeout(()=>notice('Spotify was moved to this MELO account. Your previous MELO account data was not deleted.'),120);
else if(pageParams.get('connected'))setTimeout(()=>notice(pageParams.get('connected').toUpperCase()+' connected to this MELO account.'),120);
function notice(text,error=false){const n=$('notice');n.textContent=text;n.className='notice'+(error?' error':'');n.style.display='block';clearTimeout(notice.t);notice.t=setTimeout(()=>n.style.display='none',4500)}
function providerName(u){const raw=u?.provider||u?.oauth_provider||u?.auth_provider||u?.identity_provider||u?.login_provider||u?.connection?.provider;const list=u?.providers||u?.identities||u?.connections;const vals=raw?[raw]:(Array.isArray(list)?list.map(x=>x?.provider||x?.name||x).filter(Boolean):[]);return [...new Set(vals.map(x=>String(x).replace(/[_-]+/g,' ').replace(/\b\w/g,c=>c.toUpperCase())))].join(' · ')||'MELO ACCOUNT'}
function avatar(u){const src=u?.avatar_url||u?.avatar||u?.picture||'assets/melo-cat.png?v=20260915-2';$('avatarPreview').src=src;$('avatarPreview').onerror=()=>{$('avatarPreview').src='assets/melo-cat.png?v=20260915-2'}}
function fill(u,p={}){const v={displayName:u.display_name||u.name||u.username||'',handle:p.handle||u.handle||u.username||'',bio:p.bio||u.bio||'',pronouns:p.pronouns||u.pronouns||'',country:p.country||u.country||u.country_name||'India'};fields.forEach(id=>$(id).value=v[id]||'');$('bioCount').textContent=String(v.bio.length);$('sideName').textContent=v.displayName||'MELO PLAYER';$('sideHandle').textContent='@'+(v.handle||'melo');$('sideProvider').textContent='CONNECTED VIA '+providerName(u).toUpperCase();avatar({avatar_url:p.avatar_data||u.avatar_url||u.avatar||u.picture});$('publicCard').checked=Number(p.public_card??1)===1;$('showRecent').checked=Number(p.show_recent??1)===1;$('showArtists').checked=Number(p.show_artists??1)===1;original={...v,public_card:Number(p.public_card??1),show_recent:Number(p.show_recent??1),show_artists:Number(p.show_artists??1)}}
async function getProfile(){const r=await fetch(API+'/api/profile',{credentials:'include',cache:'no-store'});const d=await r.json().catch(()=>({}));if(!r.ok||!d.authenticated)throw new Error('Please sign in to edit your account.');return d}
async function load(){try{const d=await getProfile();fill(d.user,d.profile)}catch(e){notice(e.message,true);$('saveState').textContent='SIGN IN REQUIRED';$('profileForm').querySelectorAll('input,textarea,select,button').forEach(x=>x.disabled=true)}}
$('bio').addEventListener('input',e=>$('bioCount').textContent=e.target.value.length);
$('avatarInput').addEventListener('change',e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>600*1024){notice('Avatar must be 600 KB or smaller.',true);e.target.value='';return}if(!/^image\/(png|jpeg|webp|gif)$/.test(f.type)){notice('Use PNG, JPEG, WebP or GIF.',true);e.target.value='';return}const reader=new FileReader();reader.onload=()=>{$('avatarPreview').src=reader.result;notice('Avatar ready — save changes to upload it.')};reader.readAsDataURL(f)});
$('reset').onclick=()=>{fields.forEach(id=>$(id).value=original[id]||'');$('publicCard').checked=!!original.public_card;$('showRecent').checked=!!original.show_recent;$('showArtists').checked=!!original.show_artists;$('bioCount').textContent=String(original.bio?.length||0);$('saveState').textContent='SYNCED';$('avatarInput').value='';avatar({avatar_url:original.avatar_data||'assets/melo-cat.png?v=20260915-2'});notice('Changes discarded.')};
$('profileForm').addEventListener('submit',async e=>{e.preventDefault();const payload={display_name:$('displayName').value.trim(),handle:$('handle').value.trim().replace(/^@/,''),bio:$('bio').value.trim(),pronouns:$('pronouns').value,country:$('country').value.trim(),public_card:$('publicCard').checked,show_recent:$('showRecent').checked,show_artists:$('showArtists').checked};if(!payload.display_name)return notice('Display name is required.',true);if(payload.handle&&!/^[A-Za-z0-9_-]{3,30}$/.test(payload.handle))return notice('Handle must be 3–30 letters, numbers, _ or -.',true);const file=$('avatarInput').files?.[0];if(file){const reader=new FileReader();reader.onload=()=>save({...payload,avatar_data:reader.result});reader.readAsDataURL(file)}else save(payload)});
async function save(payload){$('saveState').textContent='SAVING…';try{const r=await fetch(API+'/api/profile',{method:'PATCH',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||'Could not save your profile.');fill(d.user,d.profile);$('avatarInput').value='';$('saveState').textContent='SYNCED';notice('Profile saved across MELO.')}catch(err){$('saveState').textContent='ERROR';notice(err.message,true)}}
async function connections(){
  try{
    const d=await getProfile(),u=d.user||{};
    const r=await fetch(API+'/api/auth/connections',{credentials:'include',cache:'no-store'});
    const data=await r.json().catch(()=>({}));
    const active=new Map((data.connections||[]).map(x=>[String(x.provider||'').toLowerCase(),x]));
    const names=[['google','Google','G'],['github','GitHub','GH'],['spotify','Spotify','S']];
    $('connections').innerHTML=names.map(([id,n,icon])=>{
      const c=active.get(id),on=!!c;
      const detail=on?(c.provider_email||'Connected to this MELO account'):'Not connected';
      return '<div class="connection"><div class="connection-left"><span class="connection-icon">'+icon+'</span><div><b>'+n+'</b><small>'+detail+'</small></div></div><button class="connect-btn '+(on?'connected':'')+'" data-provider="'+id+'" '+(on?'disabled':'')+'>'+(on?'CONNECTED':'CONNECT')+'</button></div>';
    }).join('');
    document.querySelectorAll('.connect-btn:not(.connected)').forEach(btn=>btn.addEventListener('click',()=>{
      const provider=btn.dataset.provider;
      if(provider) window.location.href=API+'/api/auth/oauth/'+provider+'?mode=connect';
    }));
  }catch{
    $('connections').innerHTML='<div class="loading">COULD NOT LOAD CONNECTIONS.</div>';
  }
}
$('logoutAll').onclick=async()=>{if(!confirm('Sign out of this MELO session?'))return;try{const r=await fetch(API+'/api/auth/logout',{method:'POST',credentials:'include'});if(!r.ok)throw new Error();notice('Signed out successfully.');setTimeout(()=>location.href='login.html',700)}catch{notice('Could not sign out.',true)}};
$('deleteAccount').onclick=async()=>{
  if(!confirm('Delete your MELO account permanently? This cannot be undone.'))return;
  const typed=prompt('Type DELETE to confirm permanent account deletion.');
  if(typed!=='DELETE')return;
  try{
    const r=await fetch(API+'/api/auth/delete-account',{method:'POST',credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({confirmation:'DELETE'})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||'Could not delete your MELO account.');
    notice('MELO account deleted.');
    setTimeout(()=>location.href='index.html?account=deleted',700);
  }catch(e){notice(e.message,true)}
};
load();connections();
})();

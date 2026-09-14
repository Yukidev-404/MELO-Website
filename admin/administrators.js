(() => {
  const content = document.getElementById('page-content');
  const clock = document.getElementById('clock');
  const identity = document.getElementById('identity');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const date = ts => ts ? new Date(Number(ts) * 1000).toLocaleString([], {dateStyle:'medium',timeStyle:'short'}) : '—';
  const api = async (path, options={}) => {
    const r = await fetch(path, {credentials:'include',cache:'no-store',...options});
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = '/admin-login.html'; throw Error('Authentication required.'); }
    if (!r.ok) throw Error(d.error || `Request failed (${r.status}).`);
    return d;
  };

  function modal(title, body) {
    document.body.insertAdjacentHTML('beforeend', `<div class="admin-modal-backdrop" id="admin-modal"><div class="admin-modal"><div class="admin-modal-head"><h2>${title}</h2><button class="admin-close" id="admin-close" aria-label="Close">×</button></div>${body}</div></div>`);
    const close = () => document.getElementById('admin-modal')?.remove();
    document.getElementById('admin-close').onclick = close;
    document.getElementById('admin-modal').onclick = e => { if (e.target.id === 'admin-modal') close(); };
    return close;
  }

  function addModal() {
    const close = modal('ADD ADMINISTRATOR', `<form class="admin-form" id="add-admin-form"><div class="admin-field"><label>USERNAME</label><input id="new-admin-username" autocomplete="off" maxlength="32" placeholder="e.g. Mina"><div class="admin-help">3–32 characters. Uppercase and lowercase are distinct.</div></div><div class="admin-field"><label>EMAIL</label><input id="new-admin-email" type="email" autocomplete="email" placeholder="admin@example.com"><div class="admin-help">Used for the invitation and future account recovery.</div></div><div class="admin-field"><label>ROLE</label><input value="Admin" disabled><div class="admin-help">Only Yuki can manage administrators. Owner transfer is not available here.</div></div><div class="admin-error" id="add-admin-error"></div><div class="admin-modal-actions"><button type="button" class="admin-btn" id="cancel-add">CANCEL</button><button class="admin-btn primary" id="create-admin">CREATE ADMIN</button></div></form>`);
    document.getElementById('cancel-add').onclick = close;
    document.getElementById('add-admin-form').onsubmit = async e => {
      e.preventDefault(); const err = document.getElementById('add-admin-error'); const btn = document.getElementById('create-admin'); err.textContent=''; btn.disabled=true;
      try {
        const d = await api('/api/admin/administrators', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:document.getElementById('new-admin-username').value.trim(),email:document.getElementById('new-admin-email').value.trim()})});
        close(); inviteModal(d); load();
      } catch (x) { err.textContent = x.message; btn.disabled=false; }
    };
  }

  function inviteModal(d) {
    modal('ADMIN CREATED', `<p class="notice"><strong>${esc(d.admin.username)}</strong> has been created as an Admin.</p><p class="notice">Give this one-time invitation to the new administrator. It expires ${esc(date(d.expiresAt))} and becomes invalid after Authenticator setup.</p><div class="invite-box"><code id="invite-url">${esc(location.origin + d.invitationUrl)}</code><button class="admin-btn primary" id="copy-invite">COPY INVITATION</button></div><div class="admin-modal-actions"><button class="admin-btn" id="invite-done">DONE</button></div>`);
    document.getElementById('copy-invite').onclick = async () => { await navigator.clipboard.writeText(location.origin + d.invitationUrl); document.getElementById('copy-invite').textContent='COPIED'; };
    document.getElementById('invite-done').onclick = () => document.getElementById('admin-modal')?.remove();
  }

  function actionModal(row, action, label, description, buttonLabel) {
    const close = modal(label, `<p class="notice">${description}</p><div class="admin-error" id="action-error"></div><div class="admin-modal-actions"><button class="admin-btn" id="action-cancel">CANCEL</button><button class="admin-btn primary" id="action-confirm">${buttonLabel}</button></div>`);
    document.getElementById('action-cancel').onclick=close;
    document.getElementById('action-confirm').onclick=async()=>{const btn=document.getElementById('action-confirm');btn.disabled=true;try{const d=await api(`/api/admin/administrators/${encodeURIComponent(row.admin_id)}/${action}`,{method:'POST'});close();if(d.invitationUrl)inviteModal({...d,admin:{username:row.username},invitationUrl:d.invitationUrl});load()}catch(e){document.getElementById('action-error').textContent=e.message;btn.disabled=false}};
  }

  function render(rows) {
    const cards = rows.map(r => {
      const status = !r.enabled ? '<span class="admin-badge off"><i></i>DISABLED</span>' : r.configured ? '<span class="admin-badge"><i></i>ACTIVE</span>' : '<span class="admin-badge pending"><i></i>PENDING</span>';
      const action = r.role === 'owner' ? '' : `<button class="admin-menu" data-id="${esc(r.admin_id)}" aria-label="Administrator actions">···</button>`;
      return `<article class="admin-card"><div class="admin-name"><strong>${esc(r.username)}${r.username==='Yuki'?' · YOU':''}</strong><small>${esc(r.role)}</small></div><div class="admin-email">${esc(r.email)}<small>${r.last_login_at?'Last login · '+esc(date(r.last_login_at)):'Never signed in'}</small></div><div>${status}</div><div class="admin-role">${r.pending_invitation?'INVITATION PENDING':r.configured?'AUTHENTICATOR READY':'SETUP REQUIRED'}</div><div class="admin-actions">${action}</div></article>`;
    }).join('');
    content.innerHTML = `<section class="page admins-wrap"><div class="admin-toolbar"><div><h2>Administrators</h2><p>Manage who can enter the MELO Control Room. Owner access is restricted to Yuki.</p></div><button class="admin-add" id="add-admin">+ ADD ADMIN</button></div><div class="admin-list">${cards || '<div class="admin-empty">No administrator accounts found.</div>'}</div><div class="health-strip"><span><strong>OWNER CONTROL.</strong> Administrator actions are protected server-side.</span><span class="right">${rows.length} ACCOUNT${rows.length===1?'':'S'} </span></div></section>`;
    document.getElementById('add-admin').onclick=addModal;
    document.querySelectorAll('.admin-menu').forEach(btn=>btn.onclick=()=>{
      const row=rows.find(x=>x.admin_id===btn.dataset.id); if(!row)return;
      const options = row.enabled ? `<button class="admin-btn" id="disable-admin">DISABLE ACCOUNT</button>` : `<button class="admin-btn primary" id="enable-admin">ENABLE ACCOUNT</button>`;
      const close=modal(`${esc(row.username)}`, `<p class="notice">${esc(row.email)} · ${esc(row.role)}</p><div class="admin-modal-actions" style="justify-content:flex-start;flex-wrap:wrap">${options}<button class="admin-btn" id="revoke-admin">REVOKE SESSIONS</button><button class="admin-btn" id="reset-admin">RESET AUTHENTICATOR</button><button class="admin-btn danger" id="delete-admin">DELETE ACCOUNT</button></div>`);
      document.getElementById('disable-admin')?.addEventListener('click',()=>{close();actionModal(row,'disable','DISABLE ACCOUNT',`Disable <strong>${esc(row.username)}</strong>? They will be signed out and unable to enter the Control Room until re-enabled.`,'DISABLE');});
      document.getElementById('enable-admin')?.addEventListener('click',()=>{close();actionModal(row,'enable','ENABLE ACCOUNT',`Restore Control Room access for <strong>${esc(row.username)}</strong>?`,'ENABLE');});
      document.getElementById('revoke-admin').onclick=()=>{close();actionModal(row,'revoke-sessions','REVOKE SESSIONS',`Sign <strong>${esc(row.username)}</strong> out of all current Control Room sessions?`,'REVOKE');};
      document.getElementById('reset-admin').onclick=()=>{close();actionModal(row,'reset-authenticator','RESET AUTHENTICATOR',`This will sign <strong>${esc(row.username)}</strong> out everywhere and require a new Authenticator setup.`,'RESET');};
      document.getElementById('delete-admin').onclick=()=>{close();const confirmClose=modal('DELETE ACCOUNT',`<p class="notice">This permanently removes <strong>${esc(row.username)}</strong> and invalidates their invitation and sessions.</p><p class="notice">Type <strong>${esc(row.username)}</strong> to confirm.</p><div class="admin-field"><input id="delete-confirm-name" autocomplete="off" placeholder="${esc(row.username)}"></div><div class="admin-error" id="delete-error"></div><div class="admin-modal-actions"><button class="admin-btn" id="delete-cancel">CANCEL</button><button class="admin-btn danger" id="delete-confirm">DELETE ACCOUNT</button></div>`);document.getElementById('delete-cancel').onclick=confirmClose;document.getElementById('delete-confirm').onclick=async()=>{const btn=document.getElementById('delete-confirm'),input=document.getElementById('delete-confirm-name'),err=document.getElementById('delete-error');if(input.value!==row.username){err.textContent='Username does not match.';return}btn.disabled=true;try{await api(`/api/admin/administrators/${encodeURIComponent(row.admin_id)}/delete`,{method:'POST'});confirmClose();load()}catch(e){err.textContent=e.message;btn.disabled=false}};};
    });
  }

  async function load(){try{const d=await api('/api/admin/administrators');render(d.rows||[])}catch(e){content.innerHTML=`<section class="page"><div class="page-intro"><h2>Administrators</h2><p>${esc(e.message)}</p></div></section>`}}
  fetch('/api/admin/me',{credentials:'include',cache:'no-store'}).then(r=>r.json()).then(d=>{if(d?.role!=='owner'||d.username!=='Yuki'){location.href='/admin/';return}identity.textContent=d.username}).catch(()=>location.href='/admin-login.html');
  const tick=()=>{clock.textContent=new Date().toLocaleTimeString([], {hour12:false})};tick();setInterval(tick,1000);
  load();
  document.addEventListener('keydown',e=>{if(e.key==='Escape')document.getElementById('admin-modal')?.remove()});
})();

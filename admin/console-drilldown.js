(() => {
  const list = document.getElementById('installation-list');
  const detail = document.getElementById('installation-detail');
  const refresh = document.getElementById('refresh-installations');
  if (!list || !detail) return;

  let fleet = [];
  let activity = [];
  const esc = v => String(v ?? '—').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const api = async path => {
    const r = await fetch(path, {credentials:'include', cache:'no-store'});
    if (r.status === 401) { location.href = '../admin-login.html'; throw Error('Authentication required'); }
    if (!r.ok) throw Error(`Request failed (${r.status})`);
    return r.json();
  };
  const time = value => {
    const n = Number(value);
    if (!n) return '—';
    return new Date(n > 1e12 ? n : n * 1000).toLocaleString([], {dateStyle:'medium', timeStyle:'short'});
  };
  const relative = value => {
    const n = Number(value);
    if (!n) return 'No heartbeat recorded';
    const ms = n > 1e12 ? n : n * 1000;
    const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
    if (seconds < 60) return `${seconds}s ago`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };
  const getId = row => row.installation_id ?? row.id ?? row.installationId ?? 'unknown';

  async function load() {
    list.innerHTML = '<div class="drilldown-empty">Loading installation fleet…</div>';
    try {
      const [i, d] = await Promise.all([api('/api/admin/installations'), api('/api/admin/dashboard')]);
      fleet = i.rows || i.installations || [];
      activity = d.recentActivity || [];
      renderList();
      if (fleet.length) select(fleet[0]);
      else { detail.hidden = true; list.innerHTML = '<div class="drilldown-empty">No installations registered.</div>'; }
    } catch (e) {
      list.innerHTML = `<div class="drilldown-empty error">Unable to load fleet: ${esc(e.message)}</div>`;
    }
  }

  function renderList() {
    list.innerHTML = fleet.map((row, index) => {
      const id = getId(row), version = row.app_version ?? row.version ?? '—';
      const platform = row.platform ?? '—', last = row.last_seen ?? row.last_heartbeat ?? row.updated_at;
      const events = activity.filter(e => String(e.installation_id) === String(id)).length;
      return `<button class="installation-row${index === 0 ? ' selected' : ''}" type="button" data-index="${index}">
        <span class="install-icon">◉</span><span class="install-main"><strong>${esc(id)}</strong><small>${esc(platform)} · ${esc(version)}</small></span>
        <span class="install-health"><i></i><small>${esc(relative(last))}</small></span><span class="install-events">${events} events</span>
      </button>`;
    }).join('');
    list.querySelectorAll('.installation-row').forEach(button => button.addEventListener('click', () => {
      list.querySelectorAll('.installation-row').forEach(x => x.classList.remove('selected'));
      button.classList.add('selected');
      select(fleet[Number(button.dataset.index)]);
    }));
  }

  function select(row) {
    if (!row) return;
    const id = getId(row);
    const version = row.app_version ?? row.version ?? '—';
    const platform = row.platform ?? '—';
    const last = row.last_seen ?? row.last_heartbeat ?? row.updated_at;
    const events = activity.filter(e => String(e.installation_id) === String(id)).sort((a,b) => Number(b.timestamp||0)-Number(a.timestamp||0)).slice(0,12);
    const status = last && (Date.now() - (Number(last) > 1e12 ? Number(last) : Number(last)*1000) < 7*86400000) ? 'ACTIVE' : 'STALE';
    const extras = Object.entries(row).filter(([key]) => !['installation_id','id','installationId','app_version','version','platform','last_seen','last_heartbeat','updated_at'].includes(key) && row[key] != null && row[key] !== '').slice(0,8);
    detail.hidden = false;
    detail.innerHTML = `<div class="detail-top"><div><span>SELECTED INSTALLATION</span><h3>${esc(id)}</h3><p>${esc(platform)} · MELO ${esc(version)}</p></div><div class="detail-status ${status === 'ACTIVE' ? 'active' : 'stale'}"><i></i>${status}</div></div>
      <div class="detail-metrics"><div><span>VERSION</span><strong>${esc(version)}</strong></div><div><span>PLATFORM</span><strong>${esc(platform)}</strong></div><div><span>LAST HEARTBEAT</span><strong>${esc(relative(last))}</strong><small>${esc(time(last))}</small></div><div><span>RECENT EVENTS</span><strong>${events.length}</strong></div></div>
      ${extras.length ? `<div class="detail-extra">${extras.map(([k,v]) => `<div><span>${esc(k.replace(/_/g,' ').toUpperCase())}</span><strong>${esc(typeof v === 'object' ? JSON.stringify(v) : v)}</strong></div>`).join('')}</div>` : ''}
      <div class="detail-events"><div class="detail-events-head"><span>RECENT TELEMETRY</span><small>FROM DASHBOARD ACTIVITY</small></div>${events.length ? events.map(e => `<div class="detail-event"><span>${esc(time(e.timestamp))}</span><b>${esc(String(e.event_type || 'EVENT').toUpperCase())}</b><span>${esc(e.app_version || version)} · ${esc(e.platform || platform)}</span></div>`).join('') : '<div class="drilldown-empty">No recent telemetry events for this installation.</div>'}</div>`;
  }

  refresh.addEventListener('click', load);
  load();
})();

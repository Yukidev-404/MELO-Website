import statsWorker from './stats-worker.js';
const C="melo_admin_session";
const H=200;
const ONLINE_WINDOW=30;
const RELEASE_REPO="Yukidev-404/MELO-Desktop";

async function servePlayerCard(request,env,pathname){
  const assetUrl=new URL(request.url);
  assetUrl.pathname="/player-card-live.html";
  const asset=await env.ASSETS.fetch(new Request(assetUrl.toString(),request));
  if(!asset.ok)return asset;
  let body=await asset.text();
  if(!body.includes("melo-player-cursor.js"))body=body.replace(/<\/body>/i,'<script src="/melo-player-cursor.js?v=20260916-1"></script></body>');
  const headers=new Headers(asset.headers);
  headers.set("Content-Type","text/html; charset=UTF-8");
  headers.set("Cache-Control","no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0");
  headers.set("Pragma","no-cache");
  headers.set("Expires","0");
  headers.delete("Content-Length");
  return new Response(body,{status:asset.status,headers});
}

async function serveGetMelo(request,env){
  const assetUrl=new URL(request.url);assetUrl.pathname="/get-melo.html";
  const asset=await env.ASSETS.fetch(new Request(assetUrl.toString(),request));
  if(!asset.ok)return asset;
  let body=await asset.text();
  if(!body.includes("get-melo-releases.js"))body=body.replace(/<\/body>/i,'<script src="/get-melo-releases.js?v=20260916-2"></script></body>');
  const headers=new Headers(asset.headers);headers.set("Content-Type","text/html; charset=UTF-8");headers.set("Cache-Control","no-store");headers.delete("Content-Length");
  return new Response(body,{status:asset.status,headers});
}

async function githubReleases(env){
  const headers={Accept:'application/vnd.github+json','User-Agent':'MELO-Website-Release-Desk','X-GitHub-Api-Version':'2022-11-28'};
  if(env?.GITHUB_TOKEN)headers.Authorization=`Bearer ${env.GITHUB_TOKEN}`;
  const r=await fetch(`https://api.github.com/repos/${RELEASE_REPO}/releases?per_page=20`,{headers});
  if(!r.ok)throw new Error(`GitHub releases: ${r.status}`);
  const releases=await r.json();
  return releases.filter(x=>!x.draft&&!x.prerelease);
}

function releasePayload(releases){
  return releases.map(r=>({id:r.id,name:r.name,tag_name:r.tag_name,body:r.body||'',created_at:r.created_at,published_at:r.published_at,prerelease:!!r.prerelease,assets:(r.assets||[]).map(a=>({id:a.id,name:a.name,size:a.size,content_type:a.content_type,download_count:a.download_count}))}));
}

async function releaseApi(request,url,env){
  if(request.method!=='GET')return j({error:'Method not allowed.'},405);
  try{const releases=await githubReleases(env);const limit=Math.min(Math.max(Number(url.searchParams.get('limit')||10),1),20);return j({ok:true,repository:RELEASE_REPO,releases:releasePayload(releases).slice(0,limit)},{'Cache-Control':'public, max-age=60, s-maxage=60'});}catch(e){return j({ok:false,error:'Release service unavailable.'},502)}
}

async function downloadRelease(request,url,env){
  if(request.method!=='GET'&&request.method!=='HEAD')return j({error:'Method not allowed.'},405);
  try{
    const releases=await githubReleases(env);let release=null;
    if(url.pathname==='/download/latest')release=releases[0]||null;
    else {const id=url.pathname.split('/').pop();release=releases.find(r=>String(r.id)===String(decodeURIComponent(id)))||null;}
    if(!release)return j({error:'No published MELO release found.'},404);
    const requested=url.searchParams.get('asset');
    const assets=release.assets||[];
    const asset=(requested&&assets.find(a=>a.name===requested))||assets.find(a=>/\.(exe|msi|zip)$/i.test(a.name));
    if(!asset)return j({error:'No downloadable Windows asset found in this release.'},404);
    const upstreamHeaders={Accept:'application/octet-stream','User-Agent':'MELO-Website-Release-Desk'};
    if(env?.GITHUB_TOKEN)upstreamHeaders.Authorization=`Bearer ${env.GITHUB_TOKEN}`;
    const upstream=await fetch(asset.browser_download_url,{headers:upstreamHeaders,redirect:'follow'});
    if(!upstream.ok)return new Response('Release asset unavailable.',{status:upstream.status});
    const headers=new Headers(upstream.headers);headers.set('Content-Disposition',`attachment; filename="${asset.name.replace(/"/g,'')}"`);headers.set('Cache-Control','public, max-age=300');headers.delete('set-cookie');
    return new Response(upstream.body,{status:upstream.status,headers});
  }catch(e){return j({error:'Download service unavailable.'},502)}
}

export default{async fetch(r,e,c){
  const u=new URL(r.url);
  if(u.pathname==="/player-card.html"||u.pathname==="/player-card.html/"||u.pathname==="/player-card-v2.html"||u.pathname==="/player-card-v2.html/"||u.pathname==="/player-card-live.html"||u.pathname==="/player-card-live.html/")return servePlayerCard(r,e,u.pathname);
  if(u.pathname==="/get-melo.html"||u.pathname==="/get-melo.html/")return serveGetMelo(r,e);
  if(u.pathname==="/api/releases")return releaseApi(r,u,e);
  if(u.pathname==="/download/latest"||u.pathname.startsWith("/download/release/"))return downloadRelease(r,u,e);
  if(u.pathname.startsWith("/api/auth/"))return e.AUTH.fetch(r);
  if(u.pathname==="/api/stats"||u.pathname==="/api/stats/event")return statsWorker.fetch(r,e,c);
  if(u.pathname.startsWith("/api/admin/chat")||u.pathname==="/api/admin/notifications"||u.pathname==="/api/admin/presence"||u.pathname==="/api/admin/audit-log"||u.pathname==="/api/admin/flag"||u.pathname==="/api/admin/crash/status"||u.pathname==="/api/admin/release-status")return h(r,e,u,c);
  return(await import("./worker.js")).default.fetch(r,e,c);
}};

async function h(r,e,u,c){
  const s=await g(r,e);if(!s)return j({authenticated:false},401);
  if(["/api/admin/audit-log","/api/admin/flag","/api/admin/crash/status","/api/admin/release-status"].includes(u.pathname)){
    const ops=(await import("./admin-ops-worker.js")).default;const response=await ops.fetch(r,e,c);if(response)return response;
  }
  await z(e);
  if(u.pathname==="/api/admin/presence"&&(r.method==="POST"||r.method==="GET") ){
    const now=Math.floor(Date.now()/1000);
    await e.DB.prepare("INSERT INTO admin_presence (admin_id,last_seen_at) VALUES (?,?) ON CONFLICT(admin_id) DO UPDATE SET last_seen_at=excluded.last_seen_at").bind(s.admin_id,now).run();
    const q=await e.DB.prepare("SELECT a.admin_id,a.username,a.role,a.enabled,COALESCE(p.last_seen_at,0) last_seen_at FROM admin_accounts a LEFT JOIN admin_presence p ON p.admin_id=a.admin_id WHERE a.enabled=1 ORDER BY CASE WHEN COALESCE(p.last_seen_at,0)>=? THEN 0 ELSE 1 END,a.created_at ASC").bind(now-ONLINE_WINDOW).all();
    return j({ok:true,admins:(q.results||[]).map(a=>({admin_id:a.admin_id,username:a.username,role:a.role,enabled:a.enabled,online:Number(a.last_seen_at||0)>=now-ONLINE_WINDOW,last_seen_at:Number(a.last_seen_at||0)}))});
  }
  if(u.pathname==="/api/admin/chat"&&r.method==="GET"){
    await e.DB.prepare("INSERT INTO admin_presence (admin_id,last_seen_at) VALUES (?,?) ON CONFLICT(admin_id) DO UPDATE SET last_seen_at=excluded.last_seen_at").bind(s.admin_id,Math.floor(Date.now()/1000)).run();
    const q=await e.DB.prepare("SELECT message_id,admin_id,username,role,message,created_at FROM admin_chat_messages ORDER BY created_at DESC LIMIT ?").bind(H).all();
    return j({ok:true,messages:(q.results||[]).reverse(),currentAdmin:{admin_id:s.admin_id,username:s.username,role:s.role}});
  }
  if(u.pathname==="/api/admin/chat"&&r.method==="POST"){
    let b;try{b=await r.json()}catch{return j({error:"Invalid JSON payload."},400)}
    const m=String(b?.message||"").trim();if(!m)return j({error:"Message cannot be empty."},400);if(m.length>2000)return j({error:"Message is too long."},400);
    const t=Math.floor(Date.now()/1000),id="chat_"+x(16);
    await e.DB.prepare("INSERT INTO admin_chat_messages VALUES(?,?,?,?,?,?)").bind(id,s.admin_id,s.username,s.role,m,t).run();
    return j({ok:true,message:{message_id:id,admin_id:s.admin_id,username:s.username,role:s.role,message:m,created_at:t}});
  }
  if(u.pathname==="/api/admin/chat/read"&&r.method==="POST"){
    let b={};try{b=await r.json()}catch{}const id=String(b?.messageId||"");
    const m=await e.DB.prepare("SELECT created_at FROM admin_chat_messages WHERE message_id=?").bind(id).first();if(!m)return j({error:"Message not found."},404);
    await e.DB.prepare("INSERT INTO admin_chat_reads VALUES(?,?,?) ON CONFLICT(admin_id) DO UPDATE SET last_read_at=excluded.last_read_at,last_read_message_id=excluded.last_read_message_id").bind(s.admin_id,m.created_at,id).run();
    return j({ok:true});
  }
  if(u.pathname==="/api/admin/notifications"&&r.method==="GET"){
    const b=await(await import("./worker.js")).default.fetch(r,e);if(!b.ok)return b;const d=await b.json(),q=await e.DB.prepare("SELECT last_read_at FROM admin_chat_reads WHERE admin_id=?").bind(s.admin_id).first(),n=await e.DB.prepare("SELECT COUNT(*) count FROM admin_chat_messages WHERE created_at>?").bind(Number(q?.last_read_at||0)).first();
    return j({...d,unread:{...(d.unread||{}),chat:Number(n?.count||0)}});
  }
  return j({error:"Method not allowed."},405);
}

async function z(e){await e.DB.batch([
  e.DB.prepare("CREATE TABLE IF NOT EXISTS admin_chat_messages (message_id TEXT PRIMARY KEY,admin_id TEXT NOT NULL,username TEXT NOT NULL,role TEXT NOT NULL, message TEXT NOT NULL,created_at INTEGER NOT NULL)"),
  e.DB.prepare("CREATE INDEX IF NOT EXISTS idx_admin_chat_messages_created ON admin_chat_messages(created_at)"),
  e.DB.prepare("CREATE TABLE IF NOT EXISTS admin_chat_reads (admin_id TEXT PRIMARY KEY,last_read_at INTEGER NOT NULL DEFAULT 0,last_read_message_id TEXT)"),
  e.DB.prepare("CREATE TABLE IF NOT EXISTS admin_presence (admin_id TEXT PRIMARY KEY,last_seen_at INTEGER NOT NULL DEFAULT 0)")
])}
async function g(r,e){const m=(r.headers.get("Cookie")||"").match(new RegExp(`(?:^|;\\s*)${C}=([^;]+)`));if(!m)return null;const hsh=await q(m[1]),s=await e.DB.prepare("SELECT s.token_hash,s.expires_at,a.admin_id,a.username,a.email,a.role FROM admin_identity_sessions s JOIN admin_accounts a ON a.admin_id=s.admin_id WHERE s.token_hash=? AND a.enabled=1").bind(hsh).first();return s&&Number(s.expires_at)>Math.floor(Date.now()/1000)?s:null}
async function q(v){const d=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(v)));return[...d].map(b=>b.toString(16).padStart(2,"0")).join("")}
function x(n){const a=new Uint8Array(n);crypto.getRandomValues(a);return[...a].map(b=>b.toString(16).padStart(2,"0")).join("")}
function j(d,s=200){const status=typeof s==='object'?200:s;const extra=typeof s==='object'?s:{};return new Response(JSON.stringify(d),{status,headers:{"Content-Type":"application/json","Cache-Control":"no-store",...extra}})}

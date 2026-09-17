const RELEASE_REPO = "Yukidev-404/MELO-Desktop";
const GITHUB_API = `https://api.github.com/repos/${RELEASE_REPO}`;

function githubHeaders(env, accept = "application/vnd.github+json") {
  const headers = { Accept: accept, "User-Agent": "MELO-Website-Release-Archive", "X-GitHub-Api-Version": "2022-11-28" };
  if (env?.MELO_GITHUB_TOKEN) headers.Authorization = `Bearer ${env.MELO_GITHUB_TOKEN}`;
  return headers;
}
async function github(env, path, accept = "application/vnd.github+json") {
  const response = await fetch(`${GITHUB_API}${path}`, { headers: githubHeaders(env, accept), redirect: "manual" });
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("Location");
    if (!location) throw new Error("GitHub API redirect missing location");
    return fetch(location, { redirect: "follow", headers: { Accept: accept, "User-Agent": "MELO-Website-Release-Archive" } });
  }
  if (!response.ok) throw new Error(`GitHub API ${response.status}`);
  return response;
}
async function getReleases(env) { const response=await github(env,"/releases?per_page=20"); const releases=await response.json(); return Array.isArray(releases)?releases.filter(r=>!r.draft&&!r.prerelease):[]; }
function releasePayload(releases,limit){return releases.slice(0,limit).map(r=>({id:r.id,name:r.name||r.tag_name||"MELO Desktop",tag_name:r.tag_name,body:r.body||"",created_at:r.created_at,published_at:r.published_at,prerelease:Boolean(r.prerelease),assets:(r.assets||[]).map(a=>({id:a.id,name:a.name,size:a.size,content_type:a.content_type,download_count:a.download_count}))}));}
function json(data,status=200,extra={}){return new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff",...extra}});}
function validAssetName(name){return typeof name==="string"&&name.length<=256&&!name.includes("/")&&!name.includes("\\")&&!name.includes("\0");}
function allowedAsset(name){return typeof name==="string"&&/\.(exe|msi|zip)$/i.test(name);}
function safeVersion(tag){const value=String(tag||"").replace(/^v/i,"");return /^\d+(?:\.\d+){0,3}(?:[-+][0-9A-Za-z.-]+)?$/.test(value)?value:"";}
function compareVersions(a,b){const pa=String(a).split(/[-+]/)[0].split('.').map(Number),pb=String(b).split(/[-+]/)[0].split('.').map(Number);for(let i=0;i<Math.max(pa.length,pb.length);i++){const x=pa[i]||0,y=pb[i]||0;if(x!==y)return x-y;}return 0;}

export default { async fetch(request,env) {
 const url=new URL(request.url);
 if(url.pathname==="/api/releases"){
  if(request.method!=="GET")return json({error:"Method not allowed."},405);
  try{const raw=Number(url.searchParams.get("limit")||20),limit=Math.min(Math.max(Number.isFinite(raw)?Math.floor(raw):20,1),20),releases=await getReleases(env);return json({ok:true,repository:RELEASE_REPO,releases:releasePayload(releases,limit)},200,{"Cache-Control":"public, max-age=300, s-maxage=300"});}
  catch(error){console.error("MELO release archive API failed",error);return json({ok:false,error:"Release service unavailable."},502);}
 }
 if(url.pathname==="/api/updates/check"){
  if(request.method!=="GET"&&request.method!=="POST")return json({error:"Method not allowed."},405);
  try{
   let requested="";
   if(request.method==="POST"){const b=await request.json().catch(()=>({}));requested=String(b?.version||b?.current_version||"");}
   else requested=String(url.searchParams.get("version")||url.searchParams.get("current")||"");
   const releases=await getReleases(env),latest=releases[0],asset=latest?.assets?.find(a=>/\.exe$/i.test(a.name))||latest?.assets?.find(a=>/\.(msi|zip)$/i.test(a.name));
   if(!latest)return json({ok:true,update_available:false,latest_version:null});
   const latestVersion=safeVersion(latest.tag_name),currentVersion=safeVersion(requested),updateAvailable=Boolean(latestVersion&&currentVersion&&compareVersions(latestVersion,currentVersion)>0);
   return json({ok:true,update_available:updateAvailable,latest_version:latestVersion||latest.tag_name||null,current_version:currentVersion||requested||null,release_name:latest.name||latest.tag_name||"MELO Desktop",published_at:latest.published_at||latest.created_at||null,download_url:asset?`/download/release/${encodeURIComponent(latest.id)}?asset=${encodeURIComponent(asset.name)}`:null,asset:asset?{name:asset.name,size:asset.size}:null});
  }catch(error){console.error("MELO update check failed",error);return json({ok:false,error:"Update service unavailable."},502);}
 }
 if(url.pathname==="/download/latest"||url.pathname.startsWith("/download/release/")){
  if(request.method!=="GET"&&request.method!=="HEAD")return json({error:"Method not allowed."},405);
  try{
   const releases=await getReleases(env);let release;
   if(url.pathname==="/download/latest")release=releases[0];else{const id=decodeURIComponent(url.pathname.split("/").pop()||"");if(!/^\d+$/.test(id))return json({error:"Invalid release ID."},400);release=releases.find(r=>String(r.id)===id);}
   if(!release)return json({error:"No published MELO release found."},404);
   const requested=url.searchParams.get("asset");if(requested&&!validAssetName(requested))return json({error:"Invalid asset name."},400);if(requested&&!allowedAsset(requested))return json({error:"Asset type is not allowed."},400);
   const assets=Array.isArray(release.assets)?release.assets:[],asset=(requested&&assets.find(a=>a.name===requested&&allowedAsset(a.name)))||assets.find(a=>/\.exe$/i.test(a.name))||assets.find(a=>/\.(msi|zip)$/i.test(a.name));if(!asset)return json({error:"No downloadable Windows asset found in this release."},404);
   const upstream=await github(env,`/releases/assets/${asset.id}`,"application/octet-stream");if(!upstream.ok)return json({error:"Download source unavailable."},502);const headers=new Headers(upstream.headers);headers.set("Content-Disposition",`attachment; filename="${asset.name.replace(/[^a-zA-Z0-9._-]/g,"_")}"`);headers.set("Cache-Control","public, max-age=300, s-maxage=300");headers.set("X-Content-Type-Options","nosniff");headers.delete("set-cookie");headers.delete("authorization");if(request.method==="HEAD")return new Response(null,{status:upstream.status,headers});return new Response(upstream.body,{status:upstream.status,headers});
  }catch(error){console.error("MELO release download failed",error);return json({error:"Download service unavailable."},502);}
 }
 return json({error:"Not found."},404);
} };
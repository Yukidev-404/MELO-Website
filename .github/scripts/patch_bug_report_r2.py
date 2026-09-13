from pathlib import Path
import re

PATH = Path('worker.js')
text = PATH.read_text(encoding='utf-8')

if '/api/bug-reports/upload' in text and 'async function bugReportAttachment' in text:
    print('R2 bug report backend patch already present.')
    raise SystemExit(0)

admin_marker = '''  if (url.pathname === "/api/admin/bug-report" && request.method === "PATCH") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return updateBugReport(request, env, url);
  }
'''
admin_insert = admin_marker + '''  if (url.pathname === "/api/admin/bug-attachment" && request.method === "GET") {
    const session = await getSession(request, env);
    if (!session) return json({ authenticated: false }, 401);
    return bugReportAttachment(request, env, url);
  }
'''
if admin_marker not in text:
    raise SystemExit('Could not find the admin bug-report route block.')
text = text.replace(admin_marker, admin_insert, 1)

start = text.find('async function handleBugReports(request, env, url) {')
end = text.find('async function bugReportsData(env,url) {', start)
if start < 0 or end < 0:
    raise SystemExit('Could not find the existing bug-report handler.')

new_handler = '''async function handleBugReports(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:{ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization' } });
  if (url.pathname === '/api/bug-reports/upload') return handleBugReportUpload(request, env, url);
  if (request.method !== 'POST' || url.pathname !== '/api/bug-reports') return bugReportJson({ error:'Not found.' },404);
  const length = Number(request.headers.get('Content-Length') || 0);
  if (length > 128 * 1024) return bugReportJson({ error:'Bug report is too large.' },413);
  const now = Math.floor(Date.now()/1000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  await ensureBugReportsSchema(env);
  const key = `bug-report:${ip}`;
  const rate = await env.DB.prepare('SELECT window_start,count FROM rate_limits WHERE key=?').bind(key).first();
  if (rate && now - Number(rate.window_start) < 600 && Number(rate.count) >= 5) return bugReportJson({ error:'Too many reports. Please try again later.' },429);
  if (!rate || now - Number(rate.window_start) >= 600) await env.DB.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1').bind(key,now).run();
  else await env.DB.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').bind(key).run();
  let body; try { body = await request.json(); } catch { return bugReportJson({ error:'Invalid JSON payload.' },400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return bugReportJson({ error:'Invalid JSON payload.' },400);
  const installationId = body.installation_id == null ? null : String(body.installation_id);
  const appVersion = String(body.app_version || '').trim();
  const build = body.build == null ? '' : String(body.build).trim();
  const platform = String(body.platform || '').trim().toLowerCase();
  const osVersion = body.os_version == null ? '' : String(body.os_version).trim();
  const clientSchema = Number(body.client_schema ?? 1);
  const what = String(body.what_happened || '').trim();
  const repro = String(body.reproduction_steps || '').trim();
  const expected = String(body.expected_result || '').trim();
  if (!appVersion || appVersion.length > 64 || !/^\\d{1,32}(?:\\.\\d{1,32}){0,3}$/.test(appVersion)) return bugReportJson({ error:'Invalid app_version.' },400);
  if (platform !== 'windows') return bugReportJson({ error:'Unsupported platform.' },400);
  if (!Number.isInteger(clientSchema) || clientSchema !== 1) return bugReportJson({ error:'Unsupported client_schema.' },400);
  if (!what || what.length > 16000 || repro.length > 16000 || expected.length > 16000) return bugReportJson({ error:'Bug report text is too large or missing.' },400);
  if (installationId && !/^[A-Za-z0-9_-]{16,128}$/.test(installationId)) return bugReportJson({ error:'Invalid installation_id.' },400);
  const reportId = `bug_${randomToken(18)}`;
  await env.DB.prepare(`INSERT INTO bug_reports (report_id,installation_id,app_version,build,platform,os_version,client_schema,what_happened,reproduction_steps,expected_result,status,submitted_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,'new',?,?,?)`).bind(reportId,installationId,appVersion,build||null,platform,osVersion||null,clientSchema,what,repro||null,expected||null,now,now,now).run();
  return bugReportJson({ok:true,report_id:reportId,received_at:now,attachment_count:0});
}

const BUG_REPORT_IMAGE_TYPES = new Map([
  ['image/png', 'png'],
  ['image/jpeg', 'jpg'],
  ['image/webp', 'webp'],
  ['image/gif', 'gif'],
]);
const BUG_REPORT_MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const BUG_REPORT_UPLOAD_WINDOW = 10 * 60;
const BUG_REPORT_UPLOAD_MAX = 200;

function imageMatchesContentType(bytes, contentType) {
  const b = new Uint8Array(bytes);
  if (contentType === 'image/png') return b.length >= 8 && b[0]===0x89 && b[1]===0x50 && b[2]===0x4e && b[3]===0x47 && b[4]===0x0d && b[5]===0x0a && b[6]===0x1a && b[7]===0x0a;
  if (contentType === 'image/jpeg') return b.length >= 3 && b[0]===0xff && b[1]===0xd8 && b[2]===0xff;
  if (contentType === 'image/webp') return b.length >= 12 && String.fromCharCode(...b.slice(0,4))==='RIFF' && String.fromCharCode(...b.slice(8,12))==='WEBP';
  if (contentType === 'image/gif') return b.length >= 6 && (String.fromCharCode(...b.slice(0,6))==='GIF87a' || String.fromCharCode(...b.slice(0,6))==='GIF89a');
  return false;
}

function safeAttachmentFilename(value) {
  const raw = String(value || 'image').replace(/\\\\/g, '/').split('/').pop() || 'image';
  const clean = raw.replace(/[^A-Za-z0-9._ -]/g, '_').slice(0,255).trim();
  return clean || 'image';
}

async function handleBugReportUpload(request, env, url) {
  if (request.method === 'OPTIONS') return new Response(null, { status:204, headers:{ 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST, OPTIONS', 'Access-Control-Allow-Headers':'Content-Type, Authorization' } });
  if (request.method !== 'POST') return bugReportJson({ error:'Method not allowed.' },405);
  if (!env.BUG_REPORTS) return bugReportJson({ error:'Bug report storage is not configured.' },503);
  const auth = String(request.headers.get('Authorization') || '');
  if (!auth.startsWith('Bearer ')) return bugReportJson({ error:'Authentication required.' },401);
  const credential = await authenticateTelemetry(auth.slice(7).trim(), env);
  if (!credential) return bugReportJson({ error:'Invalid telemetry credential.' },401);
  const reportId = String(url.searchParams.get('report_id') || '');
  if (!/^bug_[A-Za-z0-9_-]{16,64}$/.test(reportId)) return bugReportJson({ error:'Invalid report ID.' },400);
  const report = await env.DB.prepare('SELECT report_id,installation_id FROM bug_reports WHERE report_id=?').bind(reportId).first();
  if (!report) return bugReportJson({ error:'Bug report not found.' },404);
  if (!report.installation_id || report.installation_id !== credential.installation_id) return bugReportJson({ error:'Bug report ownership check failed.' },403);

  const contentType = String(request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const extension = BUG_REPORT_IMAGE_TYPES.get(contentType);
  if (!extension) return bugReportJson({ error:'Only PNG, JPEG, WebP, and GIF images are allowed.' },415);
  const contentLength = Number(request.headers.get('Content-Length') || 0);
  if (contentLength > BUG_REPORT_MAX_IMAGE_BYTES) return bugReportJson({ error:'Image exceeds the 5 MB limit.' },413);

  const now = Math.floor(Date.now()/1000);
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const key = `bug-upload:${credential.installation_id}:${ip}`;
  const rate = await env.DB.prepare('SELECT window_start,count FROM rate_limits WHERE key=?').bind(key).first();
  if (rate && now - Number(rate.window_start) < BUG_REPORT_UPLOAD_WINDOW && Number(rate.count) >= BUG_REPORT_UPLOAD_MAX) return bugReportJson({ error:'Too many image uploads. Please try again later.' },429);
  if (!rate || now - Number(rate.window_start) >= BUG_REPORT_UPLOAD_WINDOW) await env.DB.prepare('INSERT INTO rate_limits (key,window_start,count) VALUES (?, ?, 1) ON CONFLICT(key) DO UPDATE SET window_start=excluded.window_start,count=1').bind(key,now).run();
  else await env.DB.prepare('UPDATE rate_limits SET count=count+1 WHERE key=?').bind(key).run();

  const bytes = await request.arrayBuffer();
  if (!bytes.byteLength) return bugReportJson({ error:'Empty image upload.' },400);
  if (bytes.byteLength > BUG_REPORT_MAX_IMAGE_BYTES) return bugReportJson({ error:'Image exceeds the 5 MB limit.' },413);
  if (!imageMatchesContentType(bytes, contentType)) return bugReportJson({ error:'Image content does not match its declared type.' },415);

  const attachmentId = `att_${randomToken(16)}`;
  const filename = safeAttachmentFilename(url.searchParams.get('filename'));
  const storageKey = `bug-reports/${reportId}/${attachmentId}.${extension}`;
  await env.BUG_REPORTS.put(storageKey, bytes, { httpMetadata: { contentType, cacheControl: 'private, no-store' }, customMetadata: { report_id: reportId, attachment_id: attachmentId } });
  try {
    await env.DB.prepare('INSERT INTO bug_report_attachments (attachment_id,report_id,filename,content_type,size_bytes,storage_key,created_at) VALUES (?,?,?,?,?,?,?)').bind(attachmentId,reportId,filename,contentType,bytes.byteLength,storageKey,now).run();
  } catch (error) {
    await env.BUG_REPORTS.delete(storageKey);
    throw error;
  }
  return bugReportJson({ok:true,report_id:reportId,attachment_id:attachmentId,filename,size_bytes:bytes.byteLength});
}

'''
text = text[:start] + new_handler + text[end:]

insert_marker = 'async function updateBugReport(request,env,url) {'
idx = text.find(insert_marker)
if idx < 0:
    raise SystemExit('Could not find updateBugReport.')

attachment_admin = '''async function bugReportAttachment(request, env, url) {
  if (!env.BUG_REPORTS) return new Response('Bug report storage is not configured.', { status:503 });
  const id = String(url.searchParams.get('id') || '');
  if (!/^att_[A-Za-z0-9_-]{16,64}$/.test(id)) return new Response('Invalid attachment ID.', { status:400 });
  const row = await env.DB.prepare('SELECT attachment_id,filename,content_type,size_bytes,storage_key FROM bug_report_attachments WHERE attachment_id=?').bind(id).first();
  if (!row || !row.storage_key) return new Response('Attachment not found.', { status:404 });
  const object = await env.BUG_REPORTS.get(row.storage_key);
  if (!object) return new Response('Attachment object not found.', { status:404 });
  const contentType = BUG_REPORT_IMAGE_TYPES.has(String(row.content_type || '').toLowerCase()) ? String(row.content_type).toLowerCase() : 'application/octet-stream';
  return new Response(object.body, { status:200, headers:{ 'Content-Type':contentType, 'Content-Length':String(row.size_bytes || object.size || 0), 'Content-Disposition':`inline; filename="${safeAttachmentFilename(row.filename)}"`, 'Cache-Control':'private, no-store', 'X-Content-Type-Options':'nosniff' } });
}

'''
text = text[:idx] + attachment_admin + text[idx:]

PATH.write_text(text, encoding='utf-8')
print('Patched worker.js for private R2 bug-report image uploads and admin streaming.')

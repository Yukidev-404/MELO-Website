from pathlib import Path

path = Path('melo-auth-worker.js')
s = path.read_text(encoding='utf-8')

old_schema = """    desktopOAuthSchemaPromise = (async () => {\n      try {\n        await env.DB.prepare('ALTER TABLE oauth_states ADD COLUMN desktop_redirect_uri TEXT').run();\n      } catch (error) {\n        if (!/duplicate column|already exists/i.test(String(error?.message || error))) throw error;\n      }\n      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS desktop_oauth_codes (\n"""
new_schema = """    desktopOAuthSchemaPromise = (async () => {\n      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS oauth_states (\n        state TEXT PRIMARY KEY,\n        provider TEXT NOT NULL,\n        redirect_uri TEXT NOT NULL,\n        code_verifier TEXT,\n        desktop_redirect_uri TEXT,\n        created_at INTEGER NOT NULL,\n        expires_at INTEGER NOT NULL\n      )`).run();\n      try {\n        await env.DB.prepare('ALTER TABLE oauth_states ADD COLUMN desktop_redirect_uri TEXT').run();\n      } catch (error) {\n        if (!/duplicate column|already exists/i.test(String(error?.message || error))) throw error;\n      }\n      await env.DB.prepare(`CREATE TABLE IF NOT EXISTS desktop_oauth_codes (\n"""

if old_schema in s:
    s = s.replace(old_schema, new_schema, 1)
elif "CREATE TABLE IF NOT EXISTS oauth_states" not in s:
    raise SystemExit('OAuth schema block not found')

old_start = """  if (desktopRedirect) await ensureDesktopOAuthSchema(env);\n  const redirectUri = `${origin(request, env)}/api/auth/oauth/${provider}/callback`;\n"""
new_start = """  await ensureDesktopOAuthSchema(env);\n  const redirectUri = `${origin(request, env)}/api/auth/oauth/${provider}/callback`;\n"""
if old_start in s:
    s = s.replace(old_start, new_start, 1)

path.write_text(s, encoding='utf-8')
print('OAuth D1 schema patch applied')

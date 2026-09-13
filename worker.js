const ADMIN_EMAIL = "tajtaranga@gmail.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/api/admin/setup/start" && request.method === "POST") {
      return setupStart(request, env);
    }

    if (url.pathname === "/api/admin/setup/verify" && request.method === "POST") {
      return setupVerify(request, env);
    }

    return env.ASSETS.fetch(request);
  }
};

async function setupStart(request, env) {
  try {
    const { email } = await request.json();

    if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return json({ error: "Unauthorized administrator." }, 403);
    }

    // Temporary bootstrap protection.
    // We'll replace this with the Cloudflare secret in the next step.
    if (!env.ADMIN_SETUP_TOKEN) {
      return json({
        error: "Admin setup is not configured on the server yet."
      }, 500);
    }

    const suppliedToken = request.headers.get("X-MELO-Setup-Token");

    if (suppliedToken !== env.ADMIN_SETUP_TOKEN) {
      return json({ error: "Unauthorized setup request." }, 403);
    }

    const secret = generateBase32Secret();

    const issuer = "MELO";
    const account = ADMIN_EMAIL;

    const otpauth = `otpauth://totp/${encodeURIComponent(
      issuer
    )}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(
      issuer
    )}&algorithm=SHA1&digits=6&period=30`;

    return json({
      setupKey: secret,
      otpauth
    });
  } catch {
    return json({ error: "Invalid setup request." }, 400);
  }
}

async function setupVerify(request, env) {
  try {
    const { email, code } = await request.json();

    if (!email || email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
      return json({ error: "Unauthorized administrator." }, 403);
    }

    if (!/^\d{6}$/.test(String(code))) {
      return json({ error: "Invalid authenticator code." }, 400);
    }

    /*
     * The complete persistent TOTP/session storage will be added next.
     * We deliberately don't pretend authentication is complete yet.
     */
    return json({
      error: "TOTP storage is not configured yet."
    }, 501);
  } catch {
    return json({ error: "Invalid verification request." }, 400);
  }
}

function generateBase32Secret(length = 32) {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);

  let secret = "";

  for (const byte of bytes) {
    secret += alphabet[byte % alphabet.length];
  }

  return secret;
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store"
    }
  });
}
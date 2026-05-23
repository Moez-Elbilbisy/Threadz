const encoder = new TextEncoder();

export async function hashPassword(password, salt) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: encoder.encode(salt), iterations: 100000, hash: "SHA-256" },
    key, 256,
  );
  return Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, "0")).join("");
}

function b64url(str) {
  return btoa(str).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function fromB64url(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return atob(str);
}

async function hmacSHA256(message, secret) {
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(message));
  return b64url(String.fromCharCode(...new Uint8Array(sig)));
}

export async function createJWT(payload, secret, expiresIn = "7d") {
  const header = { alg: "HS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const exp = now + 7 * 86400;
  const body = { ...payload, iat: now, exp };
  const enc = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(body))}`;
  const sig = await hmacSHA256(enc, secret);
  return `${enc}.${sig}`;
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, sigB64] = parts;
    const enc = `${headerB64}.${payloadB64}`;
    const expected = await hmacSHA256(enc, secret);
    if (sigB64 !== expected) return null;
    const payload = JSON.parse(fromB64url(payloadB64));
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getUserByEmail(env, email) {
  const raw = await env.ORDERS.get(`user:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : null;
}

export async function saveUser(env, email, data) {
  await env.ORDERS.put(`user:${email.toLowerCase()}`, JSON.stringify(data));
}

export async function getUserOrders(env, email) {
  const raw = await env.ORDERS.get(`user-orders:${email.toLowerCase()}`);
  return raw ? JSON.parse(raw) : [];
}

export async function addUserOrder(env, email, trackingNumber) {
  const orders = await getUserOrders(env, email);
  if (!orders.includes(trackingNumber)) {
    orders.push(trackingNumber);
    await env.ORDERS.put(`user-orders:${email.toLowerCase()}`, JSON.stringify(orders));
  }
}

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function requireMethod(request, method) {
  if (request.method !== method) {
    return json({ error: "Method not allowed" }, 405);
  }
  return null;
}

export async function sendWhatsApp(env, to, params) {
  if (!env.WA_TOKEN || !env.WA_PHONE_ID) return { success: false, error: "WhatsApp not configured" };
  let phone = to.replace(/[\s\-]/g, "");
  if (phone.startsWith("00")) phone = "+" + phone.slice(2);
  else if (phone.startsWith("0")) phone = "+2" + phone;
  else if (!phone.startsWith("+")) phone = "+2" + phone;
  const body = {
    messaging_product: "whatsapp",
    to: phone,
    type: "template",
    template: {
      name: env.WA_TEMPLATE,
      language: { code: "en" },
      components: [{
        type: "body",
        parameters: params.map(p => ({ type: "text", text: String(p) }))
      }]
    }
  };
  try {
    const res = await fetch(`https://graph.facebook.com/v25.0/${env.WA_PHONE_ID}/messages`, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + env.WA_TOKEN,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) console.error("WhatsApp send failed:", JSON.stringify(data));
    return { success: res.ok, data };
  } catch (err) {
    console.error("WhatsApp send error:", err);
    return { success: false, error: err.message };
  }
}

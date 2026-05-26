import { createJWT, verifyJWT, json } from "./_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const { code } = await request.json();
    if (!code || code !== env.ADMIN_CODE) {
      return json({ success: false, error: "Invalid access code" }, 401);
    }
    const token = await createJWT({ role: "admin" }, env.JWT_SECRET, "24h");
    return json({ success: true, token });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestGet(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");
    if (!token) {
      return json({ success: false, error: "Missing token" }, 401);
    }
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return json({ success: false, error: "Invalid or expired token" }, 401);
    }

    const orderList = [];
    const accountList = [];
    const cursorKV = await env.ORDERS.list({ prefix: "" });

    for (const key of cursorKV.keys) {
      const raw = await env.ORDERS.get(key.name);
      if (!raw) continue;
      try {
        if (key.name.startsWith("user:")) {
          accountList.push(JSON.parse(raw));
        } else if (!key.name.startsWith("user-orders:") && !key.name.startsWith("product:")) {
          orderList.push(JSON.parse(raw));
        }
      } catch {}
    }

    orderList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    accountList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return json({ success: true, orders: orderList, total: orderList.length, accounts: accountList });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: error.message }, 500);
  }
}

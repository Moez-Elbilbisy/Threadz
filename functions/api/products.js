import { verifyJWT, json } from "./_utils.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const productList = [];
    const cursorKV = await env.ORDERS.list({ prefix: "product:" });

    for (const key of cursorKV.keys) {
      const raw = await env.ORDERS.get(key.name);
      if (!raw) continue;
      try {
        productList.push(JSON.parse(raw));
      } catch {}
    }

    productList.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return json({ success: true, products: productList });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return json({ success: false, error: "Missing token" }, 401);
    }
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return json({ success: false, error: "Invalid or expired token" }, 401);
    }

    const body = await request.json();
    const { name, price, category, image, sizes, badge, description } = body;

    if (!name || !price || !category || !image) {
      return json({ success: false, error: "Missing required fields: name, price, category, image" }, 400);
    }

    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const product = {
      id,
      name,
      price: Number(price),
      category,
      image,
      sizes: Array.isArray(sizes) ? sizes : ["S", "M", "L", "XL"],
      badge: badge || "",
      description: description || "",
      createdAt: new Date().toISOString(),
    };

    await env.ORDERS.put(`product:${id}`, JSON.stringify(product));
    return json({ success: true, product });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) {
      return json({ success: false, error: "Missing token" }, 401);
    }
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") {
      return json({ success: false, error: "Invalid or expired token" }, 401);
    }

    const body = await request.json();
    const { id } = body;
    if (!id) {
      return json({ success: false, error: "Missing product id" }, 400);
    }

    await env.ORDERS.delete(`product:${id}`);
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

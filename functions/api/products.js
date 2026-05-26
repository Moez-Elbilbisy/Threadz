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
    const { name, price, category, image, sizes, badge, description, featured } = body;

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
      featured: featured === true,
      createdAt: new Date().toISOString(),
    };

    await env.ORDERS.put(`product:${id}`, JSON.stringify(product));
    return json({ success: true, product });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestPut(context) {
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
    const { id, name, price, category, image, sizes, badge, description, featured } = body;
    if (!id) {
      return json({ success: false, error: "Missing product id" }, 400);
    }

    const raw = await env.ORDERS.get(`product:${id}`);
    if (!raw) {
      return json({ success: false, error: "Product not found" }, 404);
    }

    const existing = JSON.parse(raw);
    const updated = {
      ...existing,
      name: name ?? existing.name,
      price: price !== undefined ? Number(price) : existing.price,
      category: category ?? existing.category,
      image: image ?? existing.image,
      sizes: sizes ?? existing.sizes,
      badge: badge !== undefined ? badge : existing.badge,
      description: description !== undefined ? description : existing.description,
      featured: featured !== undefined ? featured === true : existing.featured,
    };

    await env.ORDERS.put(`product:${id}`, JSON.stringify(updated));
    return json({ success: true, product: updated });
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

import { verifyJWT, json } from "./_utils.js";

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const list = [];
    const cursorKV = await env.ORDERS.list({ prefix: "collection:" });
    for (const key of cursorKV.keys) {
      const raw = await env.ORDERS.get(key.name);
      if (!raw) continue;
      try { list.push(JSON.parse(raw)); } catch {}
    }
    list.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return json({ success: true, collections: list });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "Missing token" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") return json({ success: false, error: "Invalid or expired token" }, 401);

    const body = await request.json();
    const { name, tag, description, image, link } = body;
    if (!name || !image) return json({ success: false, error: "Missing required fields: name, image" }, 400);

    const id = name.toLowerCase().replace(/\s+/g, "-") + "-" + Date.now();
    const collection = {
      id,
      name,
      tag: tag || "",
      description: description || "",
      image,
      link: link || "",
      createdAt: new Date().toISOString(),
    };

    await env.ORDERS.put(`collection:${id}`, JSON.stringify(collection));
    return json({ success: true, collection });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "Missing token" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") return json({ success: false, error: "Invalid or expired token" }, 401);

    const body = await request.json();
    const { id, name, tag, description, image, link } = body;
    if (!id) return json({ success: false, error: "Missing collection id" }, 400);

    const raw = await env.ORDERS.get(`collection:${id}`);
    if (!raw) return json({ success: false, error: "Collection not found" }, 404);

    const existing = JSON.parse(raw);
    const updated = {
      ...existing,
      name: name ?? existing.name,
      tag: tag !== undefined ? tag : existing.tag,
      description: description !== undefined ? description : existing.description,
      image: image ?? existing.image,
      link: link !== undefined ? link : existing.link,
    };

    await env.ORDERS.put(`collection:${id}`, JSON.stringify(updated));
    return json({ success: true, collection: updated });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get("token") || request.headers.get("Authorization")?.replace("Bearer ", "");
    if (!token) return json({ success: false, error: "Missing token" }, 401);
    const payload = await verifyJWT(token, env.JWT_SECRET);
    if (!payload || payload.role !== "admin") return json({ success: false, error: "Invalid or expired token" }, 401);

    const body = await request.json();
    const { id } = body;
    if (!id) return json({ success: false, error: "Missing collection id" }, 400);

    await env.ORDERS.delete(`collection:${id}`);
    return json({ success: true });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

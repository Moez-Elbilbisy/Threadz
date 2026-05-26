import { verifyJWT, json } from "./_utils.js";

const DEFAULT_SETTINGS = {
  logo: "/logo.jpg",
  favicon: "/tabicon.png",
  hero: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
  banner_crafted: "https://images.unsplash.com/photo-1613531393649-652a20dcce66?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
  about_genesis: "https://images.unsplash.com/photo-1539650116574-8efeb43e2750?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  about_cotton: "https://images.unsplash.com/photo-1618220179428-22790b461013?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  collection_obsidian: "https://images.unsplash.com/photo-1503342394128-c104d54dba01?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  collection_anubis: "https://images.unsplash.com/photo-1509631179647-0177331693ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=1200&q=80",
  journal_featured: "https://images.unsplash.com/photo-1617137968427-85924c800a22?ixlib=rb-4.0.3&auto=format&fit=crop&w=1920&q=80",
  journal_craft: "https://images.unsplash.com/photo-1618220179428-22790b461013?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
  journal_drops: "https://images.unsplash.com/photo-1509631179647-0177331693ae?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80",
};

export async function onRequestGet(context) {
  const { env } = context;
  try {
    const raw = await env.ORDERS.get("site:settings");
    const settings = raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    return json({ success: true, settings });
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
    const currentRaw = await env.ORDERS.get("site:settings");
    const current = currentRaw ? JSON.parse(currentRaw) : {};
    const updated = { ...current, ...body };

    await env.ORDERS.put("site:settings", JSON.stringify(updated));
    return json({ success: true, settings: { ...DEFAULT_SETTINGS, ...updated } });
  } catch (error) {
    return json({ success: false, error: error.message }, 500);
  }
}

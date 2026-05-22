import { verifyJWT, getUserByEmail, getUserOrders, json } from "../_utils.js";

export async function onRequest(context) {
  const { request, env } = context;

  try {
    const auth = request.headers.get("Authorization");
    if (!auth || !auth.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

    const payload = await verifyJWT(auth.slice(7), env.JWT_SECRET);
    if (!payload) {
      return json({ error: "Invalid or expired token" }, 401);
    }

    const user = await getUserByEmail(env, payload.email);
    if (!user) return json({ error: "User not found" }, 404);

    if (request.method === "DELETE") {
      const { trackingNumber } = await request.json();
      if (!trackingNumber) return json({ error: "trackingNumber is required" }, 400);

      const orders = await getUserOrders(env, payload.email);
      const filtered = orders.filter(tn => tn !== trackingNumber);
      if (filtered.length === orders.length) {
        return json({ error: "Order not found in your history" }, 404);
      }
      await env.ORDERS.put(`user-orders:${payload.email.toLowerCase()}`, JSON.stringify(filtered));

      return json({ success: true });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

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
    if (!user) {
      return json({ error: "User not found" }, 404);
    }

    const orderRefs = await getUserOrders(env, payload.email);
    const orders = (
      await Promise.all(orderRefs.map(async (tn) => {
        const raw = await env.ORDERS.get(tn);
        return raw ? JSON.parse(raw) : null;
      }))
    ).filter(Boolean);
    return json({ user: { fullName: user.fullName, email: user.email, address: user.address || null }, orders });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

import { verifyJWT, getUserByEmail, json } from "../_utils.js";

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

    if (request.method === "GET") {
      const user = await getUserByEmail(env, payload.email);
      if (!user) return json({ error: "User not found" }, 404);
      return json({ address: user.address || null });
    }

    if (request.method === "POST") {
      const { address } = await request.json();
      if (!address) return json({ error: "Address is required" }, 400);

      const user = await getUserByEmail(env, payload.email);
      if (!user) return json({ error: "User not found" }, 404);

      user.address = address;
      await env.ORDERS.put(`user:${payload.email.toLowerCase()}`, JSON.stringify(user));
      return json({ address });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

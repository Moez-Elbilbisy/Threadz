import { hashPassword, createJWT, getUserByEmail, json, requireMethod } from "../_utils.js";

export async function onRequest(context) {
  const { request, env } = context;
  const err = requireMethod(request, "POST");
  if (err) return err;

  try {
    const { email, password } = await request.json();
    if (!email || !password) {
      return json({ error: "Email and password are required" }, 400);
    }

    const user = await getUserByEmail(env, email);
    if (!user) {
      return json({ error: "Invalid email or password" }, 401);
    }

    const hashed = await hashPassword(password, user.salt);
    if (hashed !== user.hashed) {
      return json({ error: "Invalid email or password" }, 401);
    }

    const token = await createJWT({ email }, env.JWT_SECRET);
    return json({ token, user: { fullName: user.fullName, email: user.email } });
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

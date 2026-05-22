import { hashPassword, createJWT, getUserByEmail, saveUser, json, requireMethod } from "../_utils.js";

export async function onRequest(context) {
  const { request, env } = context;
  const err = requireMethod(request, "POST");
  if (err) return err;

  try {
    const { fullName, email, password } = await request.json();
    if (!fullName || !email || !password) {
      return json({ error: "All fields are required" }, 400);
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters" }, 400);
    }

    const existing = await getUserByEmail(env, email);
    if (existing) {
      return json({ error: "Email already registered" }, 409);
    }

    const salt = crypto.randomUUID();
    const hashed = await hashPassword(password, salt);
    await saveUser(env, email, { fullName, email, salt, hashed, createdAt: new Date().toISOString() });

    const token = await createJWT({ email }, env.JWT_SECRET);
    return json({ token, user: { fullName, email } }, 201);
  } catch (e) {
    return json({ error: e.message }, 500);
  }
}

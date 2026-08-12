const PROVIDERS = ["GEMINI_API_KEY"];

const mask = (v) => (v && v.length > 8 ? `${v.slice(0, 4)}…${v.slice(-4)}` : v ? "set" : "");

export async function onRequest(context) {
  const { env } = context;
  const configured = PROVIDERS.map((name) => {
    const val = env[name];
    return { name, set: Boolean(val), value: mask(val) };
  });

  let kvOk = false;
  try {
    await env.ORDERS.get("health-check");
    kvOk = true;
  } catch (e) {
    kvOk = false;
  }

  const base = env.CF_PAGES_URL || "https://threadzeg.pages.dev";
  const services = {
    billing: {
      RESEND_API_KEY: Boolean(env.RESEND_API_KEY),
      CLOUDINARY_CLOUD_NAME: Boolean(env.CLOUDINARY_CLOUD_NAME),
      ALGOLIA_APP_ID: Boolean(env.ALGOLIA_APP_ID),
      UPSTASH_REDIS_REST_URL: Boolean(env.UPSTASH_REDIS_REST_URL),
    },
    core: {
      BOSTA_API_KEY: Boolean(env.BOSTA_API_KEY),
    },
  };

  return new Response(
    JSON.stringify(
      {
        ok: kvOk,
        name: "threadzeg",
        revision: env.CF_PAGES_COMMIT_SHA || "local",
        branch: env.CF_PAGES_BRANCH || "local",
        site: base,
        aiProvider: "gemini",
        kv: kvOk ? "ok" : "error",
        configured,
        services,
        checks: ["GET /api/products", "GET /api/settings", "POST /api/auth/register", "GET /api/health"],
        tip: "Run `node scripts/validate-tools.js` locally for live key validation.",
      },
      null,
      2
    ),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      },
    }
  );
}

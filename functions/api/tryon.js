import { json } from "./_utils.js";

const SPACE = "https://yisol-idm-vton.hf.space";

async function upload(file, token) {
  const form = new FormData();
  form.append("files", file, file.name || "file.png");
  const res = await fetch(`${SPACE}/upload`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  return (await res.json())[0];
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const hfToken = env.HF_TOKEN || "";
  const auth = hfToken ? { "Authorization": `Bearer ${hfToken}` } : {};

  try {
    const formData = await request.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");
    if (!personFile || !garmentFile) {
      return json({ success: false, error: "Missing person or garment image" }, 400);
    }

    const [personUp, garmentUp] = await Promise.all([
      upload(personFile, hfToken),
      upload(garmentFile, hfToken),
    ]);

    const sess = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const commonBody = {
      data: [
        { background: personUp, layers: [], composite: null },
        garmentUp,
        "",
        true,
        false,
        30,
        42,
      ],
    };

    // Submit via queue
    await fetch(`${SPACE}/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({ ...commonBody, event_data: null, fn_index: 2, trigger_id: 25, session_hash: sess }),
    });

    // Poll for result (short-lived requests to SSE endpoint)
    const deadline = Date.now() + 120000;
    while (Date.now() < deadline) {
      const res = await fetch(`${SPACE}/queue/data?session_hash=${sess}`, {
        headers: { Accept: "text/event-stream", ...auth },
        signal: AbortSignal.timeout(10000),
      }).catch(() => null);
      if (!res) continue;

      const text = await res.text();
      const result = extractImage(text);
      if (result) return json({ success: true, result });

      await new Promise(r => setTimeout(r, 3000));
    }

    throw new Error("Space did not return a result");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
}

function extractImage(text) {
  for (const line of text.split("\n")) {
    if (!line.startsWith("data: ")) continue;
    try {
      const d = JSON.parse(line.slice(6));
      for (const c of [d?.output?.data?.[0], d?.data?.[0], Array.isArray(d) ? d[0] : null]) {
        if (!c) continue;
        const img = typeof c === "string" ? c : c?.url || c?.path || "";
        if (img) return img;
      }
    } catch {}
  }
  return null;
}

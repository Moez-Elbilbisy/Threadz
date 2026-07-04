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
  return (await res.json())[0].path;
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

    const [personPath, garmentPath] = await Promise.all([
      upload(personFile, hfToken),
      upload(garmentFile, hfToken),
    ]);

    const sess = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    // Submit to the queue (Gradio 4.x sse_v3)
    await fetch(`${SPACE}/queue/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...auth },
      body: JSON.stringify({
        data: [
          { background: personPath, layers: [], composite: null },
          { path: garmentPath, meta: { _type: "gradio.FileData" } },
          "",
          true,
          false,
          30,
          42,
        ],
        fn_index: 2,
        trigger_id: 25,
        session_hash: sess,
      }),
    });

    // Stream the SSE response from the queue
    const dataRes = await fetch(`${SPACE}/queue/data?session_hash=${sess}`, {
      headers: { Accept: "text/event-stream", ...auth },
    });

    if (!dataRes.ok) throw new Error(`Queue error: ${dataRes.status}`);

    const reader = dataRes.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const d = JSON.parse(line.slice(6));
          if (d?.success && d?.output?.data) {
            const output = d.output.data[0];
            if (output) {
              const img = typeof output === "string" ? output : output?.url || output?.path || "";
              if (img && (img.startsWith("data:") || img.startsWith("http"))) {
                return json({ success: true, result: img });
              }
            }
          }
        } catch {}
      }
    }

    throw new Error("Space did not return a result");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
}

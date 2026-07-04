import { json } from "./_utils.js";

const SPACE = "https://yisol-idm-vton.hf.space";

async function uploadFile(file, token) {
  const form = new FormData();
  form.append("files", file, file.name || "file.png");
  const res = await fetch(`${SPACE}/upload`, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data[0].path;
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

    // Upload images to the Gradio Space
    const [personPath, garmentPath] = await Promise.all([
      uploadFile(personFile, hfToken),
      uploadFile(garmentFile, hfToken),
    ]);

    // Queue the try-on job (Gradio 4.x sse_v3 queue API)
    const sessionHash = crypto.randomUUID().replace(/-/g, "").slice(0, 32);
    const queueRes = await fetch(`${SPACE}/queue/join`, {
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
        event_data: null,
        fn_index: 2,
        trigger_id: 25,
        session_hash: sessionHash,
      }),
    });

    if (!queueRes.ok) {
      const body = await queueRes.text().catch(() => "");
      throw new Error(body.slice(0, 300) || `Queue failed: ${queueRes.status}`);
    }

    // Poll the SSE data endpoint for the result
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      const dataRes = await fetch(`${SPACE}/queue/data?session_hash=${sessionHash}`, {
        headers: { ...auth, "Accept": "text/event-stream" },
      });

      const text = await dataRes.text();
      const lines = text.split("\n");

      for (let j = 0; j < lines.length; j++) {
        const line = lines[j];
        if (line.startsWith("data: ")) {
          try {
            const d = JSON.parse(line.slice(6));
            if (d?.success && d?.output?.data) {
              const result = d.output.data[0]; // output[23] = generated image
              if (result) {
                const img = typeof result === "string" ? result : result?.url || result?.path || "";
                if (img && (img.startsWith("data:") || img.startsWith("http"))) {
                  return json({ success: true, result: img });
                }
              }
            }
          } catch {}
        }
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    throw new Error("Space timed out after 120s");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
}

    throw new Error("Space timed out after 120s");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
}

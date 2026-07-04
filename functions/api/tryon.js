import { json } from "./_utils.js";

const SPACE = "https://yisol-idm-vton.hf.space";
const API = `${SPACE}/gradio_api`;

function headers(token) {
  const h = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function uploadFile(url, file, token) {
  const form = new FormData();
  form.append("files", file, file.name || "file.png");
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { "Authorization": `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data[0]; // returns {path, url, orig_name, size}
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const hfToken = env.HF_TOKEN || "";

  try {
    const formData = await request.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");

    if (!personFile || !garmentFile) {
      return json({ success: false, error: "Missing person or garment image" }, 400);
    }

    // Upload files to the Space (supports larger payloads than inline base64)
    const [personUpload, garmentUpload] = await Promise.all([
      uploadFile(`${API}/upload`, personFile, hfToken),
      uploadFile(`${API}/upload`, garmentFile, hfToken),
    ]);

    // Submit the try-on job
    const submitRes = await fetch(`${API}/call/tryon`, {
      method: "POST",
      headers: headers(hfToken),
      body: JSON.stringify({
        data: [
          { background: personUpload.path, layers: [], composite: null },
          garmentUpload.path,
          "",
          true,
          false,
          30,
          42,
        ],
      }),
    });

    if (!submitRes.ok) {
      const body = await submitRes.text().catch(() => "");
      const hint = body.includes("quota") || body.includes("429")
        ? "Hugging Face ZeroGPU quota exhausted. Try again later or get a free HF token at huggingface.co/settings/tokens."
        : body.slice(0, 300);
      throw new Error(`Space request failed: ${hint}`);
    }

    const { event_id } = await submitRes.json();
    if (!event_id) throw new Error("No event_id from Space");

    // Poll for result (model takes 10-60s, longer on cold start)
    const maxAttempts = 60; // 2 minutes at 2s intervals
    for (let i = 0; i < maxAttempts; i++) {
      const pollRes = await fetch(`${API}/call/tryon/${event_id}`, {
        headers: hfToken ? { "Authorization": `Bearer ${hfToken}` } : {},
      });

      const text = await pollRes.text();

      // Parse SSE response for process_completed
      const lines = text.split("\n");
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const data = JSON.parse(line.slice(6));
          if (Array.isArray(data) && data.length > 0) {
            const img = typeof data[0] === "string" ? data[0] : data[0]?.url || data[0]?.path;
            if (img && (img.startsWith("data:") || img.startsWith("http"))) {
              return json({ success: true, result: img });
            }
          }
        } catch {}
      }

      // Check if processing is still in progress or complete
      if (text.includes('"process_completed"')) {
        // Completed but we didn't find the image in data parsing
        // Try extracting from process_completed data
        for (const line of lines) {
          if (line.startsWith("data: ") && line.includes("process_completed")) continue;
          try {
            const d = JSON.parse(line.replace(/^data: /, ""));
            if (Array.isArray(d) && d[0]) {
              const img = typeof d[0] === "string" ? d[0] : d[0]?.url || d[0]?.path;
              if (img) return json({ success: true, result: img });
            }
          } catch {}
        }
        break;
      }

      await sleep(2000);
    }

    throw new Error("Space timed out after 120s");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ success: false, error: msg }, 500);
  }
}

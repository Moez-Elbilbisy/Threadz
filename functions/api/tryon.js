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
    const predictRes = await fetch(`${SPACE}/api/predict/`, {
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
        session_hash: sess,
      }),
    });

    if (!predictRes.ok) {
      const body = await predictRes.text().catch(() => "");
      throw new Error(body.slice(0, 300) || `Space error: ${predictRes.status}`);
    }

    const result = await predictRes.json();
    const output = result?.data?.[0];

    if (output) {
      const img = typeof output === "string" ? output : output?.url || output?.path || "";
      if (img && (img.startsWith("data:") || img.startsWith("http"))) {
        return json({ success: true, result: img });
      }
    }

    throw new Error(`Unexpected response: ${JSON.stringify(result).slice(0, 300)}`);
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

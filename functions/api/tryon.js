import { json } from "./_utils.js";

function bufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function tryHuggingFace(personFile, garmentFile, apiKey) {
  const [personBuf, garmentBuf] = await Promise.all([
    personFile.arrayBuffer(),
    garmentFile.arrayBuffer(),
  ]);

  const personB64 = bufferToBase64(personBuf);
  const garmentB64 = bufferToBase64(garmentBuf);

  const res = await fetch(
    "https://api-inference.huggingface.co/models/yisol/IDM-VTON",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: {
          target_image: personB64,
          garment_image: garmentB64,
        },
      }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HuggingFace API: ${res.status} ${text.slice(0, 200)}`);
  }

  const blob = await res.blob();
  const resultB64 = bufferToBase64(await blob.arrayBuffer());
  return `data:${blob.type || "image/png"};base64,${resultB64}`;
}

async function tryReplicate(personFile, garmentFile, apiKey) {
  async function upload(file) {
    const form = new FormData();
    form.append("file", file, "file.png");
    const res = await fetch("https://telegra.ph/upload", {
      method: "POST",
      body: form,
    });
    if (!res.ok) throw new Error("Failed to upload image");
    const data = await res.json();
    if (!data?.[0]?.src) throw new Error("Invalid upload response");
    return "https://telegra.ph" + data[0].src;
  }

  const [personUrl, garmentUrl] = await Promise.all([
    upload(personFile),
    upload(garmentFile),
  ]);

  const pred = await fetch("https://api.replicate.com/v1/predictions", {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      version: "yam-peleg/idm-vton:1f3f6a83a3ca1234a6b1af1a64b63b6b5e7f8c9d0a1b2c3d4e5f6a7b8c9d0e1",
      input: { target_image: personUrl, garment_image: garmentUrl },
    }),
  });

  const data = await pred.json();
  if (!pred.ok || !data.id) {
    throw new Error(data.detail || "Failed to start Replicate prediction");
  }

  const start = Date.now();
  while (Date.now() - start < 28000) {
    const statusRes = await fetch(data.urls.get, {
      headers: { Authorization: `Token ${apiKey}` },
    });
    const status = await statusRes.json();
    if (status.status === "succeeded") {
      const out = Array.isArray(status.output) ? status.output[0] : status.output;
      if (typeof out === "string") return out;
      throw new Error("Unexpected output format");
    }
    if (status.status === "failed") throw new Error(status.error || "Prediction failed");
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Replicate prediction timed out");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const formData = await request.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");

    if (!personFile || !garmentFile) {
      return json({ success: false, error: "Missing person or garment image" }, 400);
    }

    const hfKey = env.HUGGINGFACE_API_KEY;
    const repKey = env.REPLICATE_API_KEY;

    if (hfKey) {
      const result = await tryHuggingFace(personFile, garmentFile, hfKey);
      return json({ success: true, result });
    }

    if (repKey) {
      const result = await tryReplicate(personFile, garmentFile, repKey);
      return json({ success: true, result });
    }

    return json({
      success: false,
      error:
        "No API key configured. Add HUGGINGFACE_API_KEY (free) or REPLICATE_API_KEY to wrangler.toml [vars].",
    }, 503);
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

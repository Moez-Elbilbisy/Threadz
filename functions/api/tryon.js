import { json } from "./_utils.js";

const SPACE_URL = "https://yisol-idm-vton.hf.space";

function bufToDataURI(buf, mime) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${mime || "image/png"};base64,${btoa(binary)}`;
}

async function tryHuggingFaceSpace(personFile, garmentFile) {
  const [personBuf, garmentBuf] = await Promise.all([
    personFile.arrayBuffer(),
    garmentFile.arrayBuffer(),
  ]);

  const personData = bufToDataURI(personBuf, personFile.type);
  const garmentData = bufToDataURI(garmentBuf, garmentFile.type);

  const res = await fetch(`${SPACE_URL}/api/tryon/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      data: [
        personData,
        garmentData,
        "upper_body",
        true,
      ],
    }),
  });

  if (!res.ok) {
    let text;
    try { text = await res.text(); } catch { text = "(no body)"; }
    const hint = "Set REPLICATE_API_KEY in wrangler.toml for reliable service (free credits at replicate.com/signup).";
    throw new Error(`Space unavailable. ${hint} (${res.status}: ${text.slice(0, 150)})`);
  }

  const result = await res.json();
  const output = result?.data?.[0];

  if (typeof output === "string" && output.startsWith("data:")) return output;
  if (typeof output === "string" && output.startsWith("http")) return output;

  if (output?.path) {
    const imgRes = await fetch(`${SPACE_URL}/file=${output.path}`);
    if (!imgRes.ok) throw new Error("Failed to fetch result image");
    const blob = await imgRes.blob();
    return bufToDataURI(await blob.arrayBuffer(), blob.type);
  }

  throw new Error(`Unexpected Space response: ${JSON.stringify(result).slice(0, 300)}`);
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

    const repKey = env.REPLICATE_API_KEY;

    // Use Replicate if configured — it's reliable and ~$0.05/run
    if (repKey) {
      const result = await tryReplicate(personFile, garmentFile, repKey);
      return json({ success: true, result });
    }

    // Fallback: Hugging Face ZeroGPU (free, but may fail due to quota)
    const result = await tryHuggingFaceSpace(personFile, garmentFile);
    return json({ success: true, result });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

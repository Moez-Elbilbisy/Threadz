import { json } from "./_utils.js";

const MODEL_VERSION = "yam-peleg/idm-vton:1f3f6a83a3ca1234a6b1af1a64b63b6b5e7f8c9d0a1b2c3d4e5f6a7b8c9d0e1";

async function uploadToHosting(file) {
  const form = new FormData();
  form.append("file", file, "person.png");
  const res = await fetch("https://telegra.ph/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Failed to upload image");
  const data = await res.json();
  if (!data?.[0]?.src) throw new Error("Invalid upload response");
  return "https://telegra.ph" + data[0].src;
}

async function pollPrediction(url, token, timeoutMs = 28000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(url, {
      headers: { Authorization: `Token ${token}` },
    });
    const data = await res.json();
    if (data.status === "succeeded") return data.output;
    if (data.status === "failed") throw new Error(data.error || "Prediction failed");
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error("Prediction timed out");
}

export async function onRequestPost(context) {
  const { request, env } = context;
  try {
    const apiKey = env.REPLICATE_API_KEY;
    if (!apiKey) {
      return json({ success: false, error: "REPLICATE_API_KEY not configured" }, 503);
    }

    const formData = await request.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");

    if (!personFile || !garmentFile) {
      return json({ success: false, error: "Missing person or garment image" }, 400);
    }

    const personUrl = await uploadToHosting(personFile);
    const garmentUrl = await uploadToHosting(garmentFile);

    const prediction = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: MODEL_VERSION,
        input: {
          target_image: personUrl,
          garment_image: garmentUrl,
        },
      }),
    });

    const predictionData = await prediction.json();
    if (!prediction.ok || !predictionData.id) {
      return json({ success: false, error: predictionData.detail || "Failed to start prediction" }, 502);
    }

    const output = await pollPrediction(predictionData.urls.get, apiKey);
    return json({ success: true, result: Array.isArray(output) ? output[0] : output });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

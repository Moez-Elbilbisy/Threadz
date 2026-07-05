/**
 * Cloudflare Pages Function — /api/tryon
 *
 * Accepts a person photo + garment (file or URL), calls an external AI
 * virtual try-on provider, and returns the result image.
 *
 * Input (multipart/form-data):
 *   - person       (file, required)  — photo of the person
 *   - garment       (file, optional) — garment image file (original tryon.js protocol)
 *   - garment_url   (string, opt)    — URL to garment image (new protocol)
 *   - garment_type  (string, opt)    — "upper_body" | "lower_body" | "dress"
 *
 * Environment variables (wrangler.toml [vars]):
 *   AI_PROVIDER      "gemini" | "fal" | "segmind" | "idm-vton" | "lightx" | "piapi"   (default: "gemini")
 *   GEMINI_API_KEY   Google Gemini API key (free tier: 60 req/min, no CC needed)
 *   FAL_KEY          Fal.ai API key
 *   SEGMIND_API_KEY  Segmind API key
 *   HF_TOKEN         Hugging Face token (idm-vton fallback)
 *   PIAPI_KEY        PiAPI key (free trial at piapi.ai, then $0.07/image via Kling)
 */

export async function onRequestPost({ request, env }) {
  try {
    const form = await request.formData();
    const personFile = form.get("person");
    let garmentFile = form.get("garment");
    let garmentUrl = form.get("garment_url");
    const garmentType = form.get("garment_type") || "upper_body";

    if (!personFile) return json({ error: "Missing 'person' file" }, 400);

    // ── Resolve garment (file or URL) ──────────────────────────────────
    if (!garmentFile && !garmentUrl) {
      return json({ error: "Missing 'garment' file or 'garment_url'" }, 400);
    }

    // If garment_url was provided but no garment file, fetch it server-side
    if (!garmentFile && garmentUrl) {
      const resp = await fetch(garmentUrl);
      if (!resp.ok) throw new Error(`Failed to fetch garment URL: ${resp.status}`);
      garmentFile = new File([await resp.blob()], "garment.png", { type: "image/png" });
    }

    // ── Person image → base64 data URI ─────────────────────────────────
    const personBuf = await personFile.arrayBuffer();
    const personB64 = arrayBufferToBase64(personBuf);
    const personMime = personFile.type || "image/jpeg";
    const personDataUri = `data:${personMime};base64,${personB64}`;

    // ── Garment → base64 data URI ──────────────────────────────────────
    const garmentBuf = await garmentFile.arrayBuffer();
    const garmentB64 = arrayBufferToBase64(garmentBuf);
    const garmentMime = garmentFile.type || "image/png";
    const garmentDataUri = `data:${garmentMime};base64,${garmentB64}`;

    // ── Route ──────────────────────────────────────────────────────────
    const provider = (env.AI_PROVIDER || "gemini").toLowerCase();

    if (provider === "gemini") {
      return asImage(await geminiTryon(personDataUri, garmentDataUri, garmentType, env));
    } else if (provider === "segmind") {
      return asImage(await segmindTryon(personDataUri, garmentDataUri, garmentType, env));
    } else if (provider === "idm-vton" || provider === "gradio") {
      return await idmVtonTryon(personDataUri, garmentFile, garmentType, env);
    } else if (provider === "lightx") {
      return asImage(await lightxTryon(personFile, garmentFile, garmentType, env));
    } else if (provider === "rapidapi") {
      return asImage(await rapidapiTryon(personFile, garmentFile, garmentType, env));
    } else if (provider === "piapi") {
      return asImage(await piapiTryon(personFile, garmentFile, garmentType, env));
    } else if (provider === "pollinations") {
      return asImage(await pollinationsTryon(personFile, garmentFile, garmentType, env));
    } else if (provider === "comfyicu") {
      return asImage(await comfyicuTryon(personFile, garmentFile, garmentType, env));
    } else {
      return asImage(await falTryon(personDataUri, garmentDataUri, garmentType, env));
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
}

// ─── Fal.ai ──────────────────────────────────────────────────────────────────
async function falTryon(personDataUri, garmentDataUri, garmentType, env) {
  const key = env.FAL_KEY;
  if (!key) throw new Error("FAL_KEY not configured — set AI_PROVIDER to 'idm-vton' or configure FAL_KEY");

  const res = await fetch("https://fal.run/fashn/v1.6", {
    method: "POST",
    headers: { Authorization: `Key ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_image: personDataUri,
      garment_image: garmentDataUri,
      category: garmentType,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Fal.ai error (${res.status}): ${txt.slice(0, 300)}`);
  }

  const data = await res.json();
  const imageUrl = data.output || data.image?.url;
  if (!imageUrl) throw new Error("Fal.ai returned no image URL");

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) throw new Error("Failed to download Fal.ai result");
  return imgRes.blob();
}

// ─── Segmind ────────────────────────────────────────────────────────────────
async function segmindTryon(personDataUri, garmentDataUri, garmentType, env) {
  const key = env.SEGMIND_API_KEY;
  if (!key) throw new Error("SEGMIND_API_KEY not configured");

  const categoryMap = { upper_body: "Upper body", lower_body: "Lower body", dress: "Dress" };

  const res = await fetch("https://api.segmind.com/v1/try-on-diffusion", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model_image: personDataUri,
      cloth_image: garmentDataUri,
      category: categoryMap[garmentType] || "Upper body",
      num_inference_steps: 30,
      guidance_scale: 2.0,
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Segmind error (${res.status}): ${txt.slice(0, 300)}`);
  }

  return res.blob();
}

// ─── Google Gemini (Nano Banana) ────────────────────────────────────────────
async function geminiTryon(personDataUri, garmentDataUri, garmentType, env) {
  const key = env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `You are a virtual try-on assistant. The first image is a person. The second image is a garment (${garmentType.replace("_", " ")}).

Put the garment on the person realistically. Follow these rules exactly:
- Keep the person's face, hair, skin tone, body shape, and pose unchanged.
- Keep the background and lighting identical to the original photo.
- Only replace the ${garmentType.replace("_", " ")} area with the new garment.
- The garment must look natural — match its shape, draping, and texture to the person's body.
- Do NOT add accessories, change the background, or modify anything outside the clothing area.
- The result should look like a real photo of the person wearing the new garment.`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-image:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: personDataUri.startsWith("data:image/png") ? "image/png" : "image/jpeg", data: personDataUri.split(",")[1] } },
            { inline_data: { mime_type: garmentDataUri.startsWith("data:image/png") ? "image/png" : "image/jpeg", data: garmentDataUri.split(",")[1] } },
          ],
        }],
        generationConfig: { temperature: 0.4, topK: 32, topP: 1, maxOutputTokens: 8192 },
      }),
    }
  );

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Gemini error (${res.status}): ${txt.slice(0, 400)}`);
  }

  const data = await res.json();

  // Extract the generated image from the response
  const part = data.candidates?.[0]?.content?.parts?.find((p) => p.inline_data);
  if (!part?.inline_data?.data) {
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || JSON.stringify(data).slice(0, 300);
    throw new Error(`Gemini returned no image: ${text}`);
  }

  const mimeType = part.inline_data.mime_type || "image/png";
  const binaryStr = atob(part.inline_data.data);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

// ─── IDM-VTON / Custom Gradio ──────────────────────────────────────────────
async function idmVtonTryon(personDataUri, garmentFile, garmentType, env) {
  const token = env.HF_TOKEN;
  if (!token) throw new Error("HF_TOKEN required for Gradio-based providers");

  const HF_BASE = env.GRADIO_BASE_URL || "https://yisol-idm-vton.hf.space";
  const sessionHash = crypto.randomUUID();

  const categoryLabels = { upper_body: "Upper body", lower_body: "Lower body", dress: "Dress" };

  // Upload a file and return its server path
  async function uploadFile(file, name) {
    const fd = new FormData();
    fd.append("files", file, name);
    const res = await fetch(`${HF_BASE}/upload`, {
      method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
    });
    if (!res.ok) throw new Error(`Upload failed for ${name}: ${res.status}`);
    const data = await res.json();
    if (Array.isArray(data) && typeof data[0] === "string") return data[0];
    if (Array.isArray(data) && data[0]?.path) return data[0].path;
    throw new Error(`Unexpected upload response: ${JSON.stringify(data).slice(0, 100)}`);
  }

  const personBlob = await (await fetch(personDataUri)).blob();
  const [personPath, garmentPath] = await Promise.all([
    uploadFile(personBlob, "person.png"),
    uploadFile(garmentFile, "garment.png"),
  ]);

  // The Space's ImageEditor expects {background, layers[], composite}
  const personRef = {
    background: `${HF_BASE}/file=${personPath}`,
    layers: [],
    composite: `${HF_BASE}/file=${personPath}`,
  };

  const garmentRef = `${HF_BASE}/file=${garmentPath}`;

  // Queue the job with fn_index=2 (tryon function)
  const fileRef = (p) => ({ path: p, meta: { _type: "gradio.FileData" } });
  const joinRes = await fetch(`${HF_BASE}/queue/join`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      fn_index: 2,
      session_hash: sessionHash,
      data: [
        { background: fileRef(personPath), layers: [], composite: fileRef(personPath) },
        fileRef(garmentPath),
        `A ${garmentType.replace("_", " ")} garment`,
        true,
        false,
        30,
        42,
      ],
      event_data: null,
    }),
  });
  if (!joinRes.ok) {
    const txt = await joinRes.text().catch(() => "");
    throw new Error(`IDM-VTON queue join failed: ${txt.slice(0, 200)}`);
  }

  // SSE stream for result
  const sseRes = await fetch(`${HF_BASE}/queue/data?session_hash=${sessionHash}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  let resultUrl = null, maskUrl = null;
  let events = [];
  const decoder = new TextDecoder();

  function resolveFile(v) {
    if (!v) return null;
    const u = typeof v === "string" ? v : v.url || v.path;
    return u && !u.startsWith("http") ? `${HF_BASE}/file=${u}` : u;
  }

  try {
    const reader = sseRes.body.getReader();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";
      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        try {
          const msg = JSON.parse(line.slice(6));
          events.push(msg.msg);
          if (msg.msg === "process_completed") {
            resultUrl = resolveFile(msg.output?.data?.[0]);
            maskUrl = resolveFile(msg.output?.data?.[1]);
            if (!resultUrl) events.push("RAW:" + JSON.stringify(msg).slice(0, 300));
            break;
          }
        } catch {}
      }
      if (resultUrl) break;
    }
  } catch (e) {
    throw new Error(`IDM-VTON SSE error: ${e.message} (events: ${events.join(", ")})`);
  }

  if (!resultUrl) throw new Error(`IDM-VTON returned no result (events: ${events.join(", ")})`);

  // Download try-on result and mask
  const [resultBlob, maskBlob] = await Promise.all([
    fetch(resultUrl, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.blob()),
    maskUrl ? fetch(maskUrl, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.blob()) : Promise.resolve(null),
  ]);

  // Return both images as JSON with base64
  const toB64 = async (blob) => {
    const buf = await blob.arrayBuffer();
    const bytes = new Uint8Array(buf);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  return json({
    result: `data:${resultBlob.type || "image/png"};base64,${await toB64(resultBlob)}`,
    mask: maskBlob ? `data:${maskBlob.type || "image/png"};base64,${await toB64(maskBlob)}` : null,
  });
}

// ─── LightX ─────────────────────────────────────────────────────────────────
async function lightxTryon(personFile, garmentFile, garmentType, env) {
  const key = env.LIGHTX_API_KEY;
  if (!key) throw new Error("LIGHTX_API_KEY not configured");

  const API = "https://api.lightxeditor.com/external/api/v2";

  async function uploadToLightX(blob, name) {
    const buf = await blob.arrayBuffer();
    const size = buf.byteLength;
    const contentType = blob.type || "image/jpeg";

    const urlRes = await fetch(`${API}/uploadImageUrl`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ uploadType: "imageUrl", size, contentType }),
    });
    if (!urlRes.ok) {
      const txt = await urlRes.text().catch(() => "");
      throw new Error(`LightX upload URL failed for ${name}: ${txt.slice(0, 200)}`);
    }
    const urlData = await urlRes.json();
    if (urlData.statusCode !== 2000) throw new Error(`LightX upload URL error: ${urlData.message}`);
    const { uploadImage, imageUrl } = urlData.body;

    const putRes = await fetch(uploadImage, {
      method: "PUT", headers: { "Content-Type": contentType }, body: buf,
    });
    if (!putRes.ok) {
      let txt = "";
      try { txt = await putRes.text(); } catch {}
      throw new Error(`LightX S3 upload failed for ${name}: HTTP ${putRes.status} ${txt.slice(0, 200)}`);
    }

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const check = await fetch(imageUrl, { method: "HEAD" }).catch(() => null);
      if (check && check.ok) return imageUrl;
    }
    throw new Error(`LightX image URL not accessible for ${name} after upload`);
  }

  const [personUrl, garmentUrl] = await Promise.all([
    uploadToLightX(personFile, "person"),
    uploadToLightX(garmentFile, "garment"),
  ]);

  const segType = garmentType === "lower_body" ? 1 : garmentType === "dress" ? 2 : 0;
  const tryonRes = await fetch(`${API}/outfit`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ imageUrl: personUrl, textPrompt: `Person wearing this ${garmentType.replace("_", " ")} garment`, styleImageUrl: garmentUrl }),
  });
  let tryonBody = "";
  try { tryonBody = await tryonRes.text(); } catch {}
  if (!tryonRes.ok) throw new Error(`LightX tryon error (${tryonRes.status}): ${tryonBody.slice(0, 500)}`);
  let tryonData;
  try { tryonData = JSON.parse(tryonBody); } catch { throw new Error(`LightX tryon bad JSON: ${tryonBody.slice(0, 500)}`); }
  if (tryonData.statusCode !== 2000) throw new Error(`LightX tryon error: ${tryonData.message} (full: ${tryonBody.slice(0, 500)})`);
  const { orderId } = tryonData.body;

  let outputUrl = null;
  let statusLog = [];
  for (let attempt = 0; attempt < 10; attempt++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(`${API}/order-status`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": key },
      body: JSON.stringify({ orderId }),
    });
    let statusBody = "";
    try { statusBody = await statusRes.text(); } catch {}
    statusLog.push(`attempt=${attempt} http=${statusRes.status} body=${statusBody.slice(0, 300)}`);
    if (!statusRes.ok) continue;
    let statusData;
    try { statusData = JSON.parse(statusBody); } catch { continue; }
    const st = statusData.body?.status || "unknown";
    if (st === "active") { outputUrl = statusData.body.output; break; }
    if (st === "failed") throw new Error(`LightX try-on failed: ${statusLog.join(" | ")}`);
  }
  if (!outputUrl) throw new Error(`LightX try-on did not complete. Log: ${statusLog.join(" | ")}`);

  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) throw new Error("Failed to download LightX result");
  return imgRes.blob();
}

// ─── RapidAPI (Texel.Moda VTON-D) ──────────────────────────────────────────
async function rapidapiTryon(personFile, garmentFile, garmentType, env) {
  const key = env.RAPIDAPI_KEY;
  if (!key) throw new Error("RAPIDAPI_KEY not configured");

  const lightxKey = env.LIGHTX_API_KEY;
  if (!lightxKey) throw new Error("LIGHTX_API_KEY also required to host person image for RapidAPI");

  async function upload(url, blob, name) {
    const buf = await blob.arrayBuffer();
    const size = buf.byteLength;
    const ct = blob.type || "image/jpeg";
    const urlRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": lightxKey },
      body: JSON.stringify({ uploadType: "imageUrl", size, contentType: ct }),
    });
    if (!urlRes.ok) throw new Error(`Upload URL failed for ${name}`);
    const d = await urlRes.json();
    if (d.statusCode !== 2000) throw new Error(`Upload URL error: ${d.message}`);
    const put = await fetch(d.body.uploadImage, { method: "PUT", headers: { "Content-Type": ct }, body: buf });
    if (!put.ok) throw new Error(`S3 upload failed for ${name}`);
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const c = await fetch(d.body.imageUrl, { method: "HEAD" }).catch(() => null);
      if (c && c.ok) return d.body.imageUrl;
    }
    throw new Error(`Image URL not accessible for ${name}`);
  }

  const api = "https://api.lightxeditor.com/external/api/v2";
  const [personUrl, clothingUrl] = await Promise.all([
    upload(`${api}/uploadImageUrl`, personFile, "person"),
    upload(`${api}/uploadImageUrl`, garmentFile, "garment"),
  ]);

  const res = await fetch("https://try-on-diffusion.p.rapidapi.com/try-on-url", {
    method: "POST",
    headers: {
      "X-RapidAPI-Key": key,
      "X-RapidAPI-Host": "try-on-diffusion.p.rapidapi.com",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ avatar_image_url: personUrl, clothing_image_url: clothingUrl, seed: -1 }),
  });

  if (!res.ok) {
    let txt = "";
    try { txt = await res.text(); } catch {}
    throw new Error(`RapidAPI error (${res.status}): ${txt.slice(0, 400)}`);
  }

  return res.blob();
}

// ─── PiAPI (Kling Virtual Try-On) ──────────────────────────────────────────
async function piapiTryon(personFile, garmentFile, garmentType, env) {
  const key = env.PIAPI_KEY;
  if (!key) throw new Error("PIAPI_KEY not configured — set it in wrangler.toml");

  // Need LightX to host the person image (PiAPI requires URLs, not files)
  const lightxKey = env.LIGHTX_API_KEY;
  if (!lightxKey) throw new Error("LIGHTX_API_KEY also required to host person image for PiAPI");

  // Reuse LightX upload function
  async function upload(blob, name) {
    const buf = await blob.arrayBuffer();
    const size = buf.byteLength;
    const ct = blob.type || "image/jpeg";

    const urlRes = await fetch("https://api.lightxeditor.com/external/api/v2/uploadImageUrl", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": lightxKey },
      body: JSON.stringify({ uploadType: "imageUrl", size, contentType: ct }),
    });
    if (!urlRes.ok) throw new Error(`LightX upload URL failed for ${name}`);
    const d = await urlRes.json();
    if (d.statusCode !== 2000) throw new Error(`LightX upload URL error: ${d.message}`);

    const put = await fetch(d.body.uploadImage, {
      method: "PUT", headers: { "Content-Type": ct }, body: buf,
    });
    if (!put.ok) throw new Error(`LightX S3 upload failed for ${name}`);

    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const c = await fetch(d.body.imageUrl, { method: "HEAD" }).catch(() => null);
      if (c && c.ok) return d.body.imageUrl;
    }
    throw new Error(`LightX image URL not accessible for ${name} after upload`);
  }

  // Upload both images to LightX CDN (PiAPI requires URLs, not files)
  const [personUrl, garmentUrl] = await Promise.all([
    upload(personFile, "person"),
    upload(garmentFile, "garment"),
  ]);

  // Map garment type to PiAPI/Kling field
  const gtype = (garmentType || "upper_body").toLowerCase();
  const inputField = gtype === "dress" ? "dress_input" : gtype === "lower_body" ? "lower_input" : "upper_input";

  // Submit task to PiAPI
  const taskRes = await fetch("https://api.piapi.ai/api/v1/task", {
    method: "POST",
    headers: { "x-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "kling",
      task_type: "ai_try_on",
      input: {
        model_input: personUrl,
        [inputField]: garmentUrl,
        batch_size: 1,
      },
    }),
  });

  if (!taskRes.ok) {
    const txt = await taskRes.text().catch(() => "");
    throw new Error(`PiAPI task creation failed (${taskRes.status}): ${txt.slice(0, 400)}`);
  }

  const taskData = await taskRes.json();
  const taskId = taskData.data?.task_id;
  if (!taskId) throw new Error(`PiAPI returned no task_id: ${JSON.stringify(taskData).slice(0, 300)}`);

  // Poll for result
  let outputUrl = null;
  let attempts = 0;
  const maxAttempts = 30;
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(r => setTimeout(r, 3000));

    const statusRes = await fetch(`https://api.piapi.ai/api/v1/task/${taskId}`, {
      headers: { "x-api-key": key },
    });
    if (!statusRes.ok) continue;

    const statusData = await statusRes.json();
    const status = statusData.data?.status;

    if (status === "completed") {
      outputUrl = statusData.data?.output?.imgs?.[0] ||
                  statusData.data?.output?.images?.[0] ||
                  statusData.data?.output?.image ||
                  statusData.data?.output?.img;
      break;
    } else if (status === "failed") {
      const errMsg = statusData.data?.error || statusData.message || "unknown error";
      throw new Error(`PiAPI task failed: ${errMsg}`);
    }
    // else "processing" or "queued" — keep polling
  }

  if (!outputUrl) throw new Error(`PiAPI did not complete after ${maxAttempts} polls`);

  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) throw new Error("Failed to download PiAPI result");
  return imgRes.blob();
}

// ─── Pollinations.ai (nanobanana-pro) ─────────────────────────────────────
async function pollinationsTryon(personFile, garmentFile, garmentType, env) {
  const key = env.POLLINATIONS_API_KEY;
  if (!key) throw new Error("POLLINATIONS_API_KEY not configured");

  const lightxKey = env.LIGHTX_API_KEY;
  if (!lightxKey) throw new Error("LIGHTX_API_KEY also required to host images for Pollinations");

  async function upload(blob, name) {
    const buf = await blob.arrayBuffer();
    const size = buf.byteLength;
    const ct = blob.type || "image/jpeg";
    const urlRes = await fetch("https://api.lightxeditor.com/external/api/v2/uploadImageUrl", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": lightxKey },
      body: JSON.stringify({ uploadType: "imageUrl", size, contentType: ct }),
    });
    if (!urlRes.ok) throw new Error(`LightX upload URL failed for ${name}`);
    const d = await urlRes.json();
    if (d.statusCode !== 2000) throw new Error(`LightX upload URL error: ${d.message}`);
    const put = await fetch(d.body.uploadImage, {
      method: "PUT", headers: { "Content-Type": ct }, body: buf,
    });
    if (!put.ok) throw new Error(`LightX S3 upload failed for ${name}`);
    for (let i = 0; i < 5; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const c = await fetch(d.body.imageUrl, { method: "HEAD" }).catch(() => null);
      if (c && c.ok) return d.body.imageUrl;
    }
    throw new Error(`LightX image URL not accessible for ${name} after upload`);
  }

  const [personUrl, garmentUrl] = await Promise.all([
    upload(personFile, "person"),
    upload(garmentFile, "garment"),
  ]);

  const gtype = (garmentType || "upper_body").replace("_", " ");
  const prompt = `Virtual try-on: Place this ${gtype} garment onto the person in the first image. Keep the person's face, hair, skin tone, body shape, pose, background, and lighting unchanged. Only replace the ${gtype} area with the new garment. The result must look like a real photo. Do not modify anything outside the clothing area.`;

  const res = await fetch("https://gen.pollinations.ai/v1/images/generations", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "nanobanana-pro",
      prompt,
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
      image: [personUrl, garmentUrl],
    }),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Pollinations error (${res.status}): ${txt.slice(0, 400)}`);
  }

  const data = await res.json();
  const b64 = data.data?.[0]?.b64_json;
  if (!b64) throw new Error("Pollinations returned no image data");

  const binaryStr = atob(b64);
  const bytes = new Uint8Array(binaryStr.length);
  for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

// ─── ComfyICU (CatVTON / Nano Banana) ─────────────────────────────────────
async function comfyicuTryon(personFile, garmentFile, garmentType, env) {
  const apiKey = env.COMFYICU_API_KEY;
  if (!apiKey) throw new Error("COMFYICU_API_KEY not configured");

  const workflowId = env.COMFYICU_WORKFLOW_ID;
  if (!workflowId) throw new Error("COMFYICU_WORKFLOW_ID not configured");

  const BASE = "https://comfy.icu";
  const auth = { "Authorization": `Bearer ${apiKey}` };

  // Upload person + garment images to ComfyICU first
  async function uploadImage(file, filename) {
    const fd = new FormData();
    fd.append("image", file, filename);
    fd.append("type", "input");
    fd.append("overwrite", "true");
    const res = await fetch(`${BASE}/api/upload/image`, {
      method: "POST", headers: auth, body: fd,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`ComfyICU upload failed for ${filename}: ${res.status} ${txt.slice(0, 200)}`);
    }
    return res.json();
  }

  await Promise.all([
    uploadImage(personFile, "person.png"),
    uploadImage(garmentFile, "garment.png"),
  ]);

  const gtype = (garmentType || "upper_body").replace("_", " ");
  const seed = Math.floor(Math.random() * 1125899906842624);

  const prompt = {
    "2": {
      "inputs": { "filename_prefix": "ComfyUI", "images": ["11", 0] },
      "class_type": "SaveImage",
      "_meta": { "title": "Save Image" }
    },
    "3": {
      "inputs": { "image": "person.png" },
      "class_type": "LoadImage",
      "_meta": { "title": "Load Person" }
    },
    "7": {
      "inputs": { "image": "garment.png" },
      "class_type": "LoadImage",
      "_meta": { "title": "Load Garment" }
    },
    "9": {
      "inputs": { "images.image0": ["3", 0], "images.image1": ["7", 0] },
      "class_type": "BatchImagesNode",
      "_meta": { "title": "Batch Images" }
    },
    "11": {
      "inputs": {
        "prompt": `Virtual try-on: Place this ${gtype} garment onto the person in the first image. Keep the person's face, hair, skin tone, body shape, pose, background, and lighting unchanged. Only replace the ${gtype} area with the new garment. The result must look like a real photo.`,
        "model": "gemini-2.5-flash-image",
        "seed": seed,
        "aspect_ratio": "auto",
        "response_modalities": "IMAGE+TEXT",
        "system_prompt": "You are a virtual try-on assistant. Always produce an image showing the person wearing the garment naturally.",
        "images": ["9", 0]
      },
      "class_type": "GeminiImageNode",
      "_meta": { "title": "Nano Banana (Google Gemini Image)" }
    }
  };

  const runRes = await fetch(`${BASE}/api/v1/workflows/${workflowId}/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ workflow_id: workflowId, prompt }),
  });

  if (!runRes.ok) {
    const txt = await runRes.text().catch(() => "");
    throw new Error(`ComfyICU run error (${runRes.status}): ${txt.slice(0, 400)}`);
  }

  const runData = await runRes.json();
  const runId = runData.id;
  if (!runId) throw new Error(`ComfyICU returned no run ID: ${JSON.stringify(runData).slice(0, 200)}`);

  let outputUrl = null;
  for (let attempt = 0; attempt < 120; attempt++) {
    await new Promise(r => setTimeout(r, 3000));
    const statusRes = await fetch(
      `${BASE}/api/v1/workflows/${workflowId}/runs/${runId}`,
      { headers: auth }
    );
    if (!statusRes.ok) continue;
    const statusData = await statusRes.json();
    if (statusData.status === "COMPLETED") {
      outputUrl = statusData.output?.[0]?.url;
      if (!outputUrl) throw new Error(`ComfyICU completed but no output URL`);
      break;
    } else if (statusData.status === "ERROR") {
      throw new Error(`ComfyICU run failed: ${JSON.stringify(statusData).slice(0, 500)}`);
    }
  }

  if (!outputUrl) throw new Error("ComfyICU did not complete in time");

  const imgRes = await fetch(outputUrl);
  if (!imgRes.ok) throw new Error("Failed to download ComfyICU result");
  return imgRes.blob();
}

// ─── Utilities ──────────────────────────────────────────────────────────────
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function asImage(blob) {
  return new Response(blob, { headers: { "Content-Type": "image/png", "Cache-Control": "no-store" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

/**
 * Cloudflare Pages Function — /api/tryon
 *
 * Single free provider: Google Gemini image model (free tier via Google AI
 * Studio, no credit card — free-for.dev "Major Cloud Providers").
 * Paid / credit-burning providers (ComfyICU, PiAPI, Fal, Segmind, LightX,
 * RapidAPI, IDM-VTON) were removed.
 *
 * Input (multipart/form-data):
 *   - person       (file, required)  — photo of the person
 *   - garment       (file, optional) — garment image file (original tryon.js protocol)
 *   - garment_url   (string, opt)    — URL to garment image (new protocol)
 *   - garment_type  (string, opt)    — "upper_body" | "lower_body" | "dress"
 *
 * Environment variables (wrangler.toml [vars]):
 *   GEMINI_API_KEY   Google Gemini API key (free tier, no CC needed)
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

    // ── Route (Gemini only — free tier) ────────────────────────────────
    return asImage(await geminiTryon(personDataUri, garmentDataUri, garmentType, env));
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ error: msg }, 500);
  }
}

// ─── Google Gemini (Nano Banana image model — free tier) ───────────────────
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

function arrayBufferToBase64(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function asImage(blob) {
  return new Response(blob, { headers: { "Content-Type": blob.type || "image/png" } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

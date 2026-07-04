import { json } from "./_utils.js";

async function uploadToTelegraph(file) {
  const form = new FormData();
  form.append("file", file, "file.png");
  const res = await fetch("https://telegra.ph/upload", { method: "POST", body: form });
  if (!res.ok) throw new Error("Upload failed");
  const data = await res.json();
  if (!data?.[0]?.src) throw new Error("Upload response invalid");
  return "https://telegra.ph" + data[0].src;
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

    // Upload images to temporary hosting for the AI model
    const [personUrl, garmentUrl] = await Promise.all([
      uploadToTelegraph(personFile),
      uploadToTelegraph(garmentFile),
    ]);

    // Call Cloudflare Workers AI — pruna/p-image-try-on (free tier: 100k req/day)
    const response = await env.AI.run("pruna/p-image-try-on", {
      person_image: personUrl,
      garment_images: [garmentUrl],
    });

    const image = response?.result?.image || response?.image || response;
    return json({ success: true, result: image });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

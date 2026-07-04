import { json } from "./_utils.js";

async function fileToDataURI(file) {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:${file.type || "image/jpeg"};base64,${btoa(binary)}`;
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

    const [personData, garmentData] = await Promise.all([
      fileToDataURI(personFile),
      fileToDataURI(garmentFile),
    ]);

    const response = await env.AI.run("pruna/p-image-try-on", {
      person_image: personData,
      garment_images: [garmentData],
    });

    const image = response?.result?.image || response?.image || response;
    return json({ success: true, result: image });
  } catch (err) {
    return json({ success: false, error: err.message }, 500);
  }
}

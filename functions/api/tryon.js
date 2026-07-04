import { events } from "fetch-event-stream";

const SPACE = "yisol/IDM-VTON";
const BASE = `https://${SPACE.replace("/", "-")}.hf.space`;

export async function onRequestPost(context) {
  const { request, env } = context;
  const hfToken = env.HF_TOKEN;

  if (!hfToken) {
    return Response.json(
      { success: false, error: "HF_TOKEN not configured" },
      { status: 500 }
    );
  }

  try {
    const formData = await request.formData();
    const personFile = formData.get("person");
    const garmentFile = formData.get("garment");

    if (!personFile || !garmentFile) {
      return Response.json(
        { success: false, error: "Missing person or garment image" },
        { status: 400 }
      );
    }

    const personBuf = await personFile.arrayBuffer();
    const garmentBuf = await garmentFile.arrayBuffer();

    const [personPath, garmentPath] = await Promise.all([
      uploadImage(personBuf, personFile.name || "person.jpg", hfToken),
      uploadImage(garmentBuf, garmentFile.name || "garment.jpg", hfToken),
    ]);

    const sessionHash = crypto.randomUUID().replace(/-/g, "") +
      crypto.randomUUID().replace(/-/g, "");

    const joinBody = {
      data: [
        {
          background: { path: personPath, url: `${BASE}/file=${personPath}` },
          layers: [],
          composite: null,
        },
        { path: garmentPath, url: `${BASE}/file=${garmentPath}` },
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
    };

    const joinRes = await fetch(`${BASE}/queue/join`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${hfToken}`,
      },
      body: JSON.stringify(joinBody),
    });

    const joinResult = await joinRes.json();
    if (!joinResult.event_id) {
      return Response.json(
        { success: false, error: "Failed to join model queue" },
        { status: 500 }
      );
    }

    const sseRes = await fetch(
      `${BASE}/queue/data?session_hash=${sessionHash}`,
      {
        headers: { Authorization: `Bearer ${hfToken}` },
      }
    );

    let resultData = null;
    for await (const event of events(sseRes)) {
      try {
        const msg = JSON.parse(event.data);
        if (msg.msg === "process_completed") {
          resultData = msg;
          break;
        }
      } catch {
        /* skip parse errors */
      }
    }

    if (!resultData || !resultData.success) {
      return Response.json(
        { success: false, error: "Model processing failed" },
        { status: 500 }
      );
    }

    const resultUrl = resultData.output?.data?.[0]?.url;
    if (!resultUrl) {
      return Response.json(
        { success: false, error: "No result image" },
        { status: 500 }
      );
    }

    const imgRes = await fetch(resultUrl);
    const imgBuf = await imgRes.arrayBuffer();

    return new Response(imgBuf, {
      status: 200,
      headers: { "Content-Type": "image/png" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return Response.json({ success: false, error: msg }, { status: 500 });
  }
}

async function uploadImage(buf, filename, token) {
  const blob = new Blob([buf], { type: "image/jpeg" });
  const form = new FormData();
  form.append("files", blob, filename);

  const res = await fetch(`${BASE}/upload?upload_id=${crypto.randomUUID()}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });

  const data = await res.json();
  return data[0];
}

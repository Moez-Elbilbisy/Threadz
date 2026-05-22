export async function onRequestGet(context) {
  const { request, env } = context;

  const url = new URL(request.url);
  const trackingNumber = url.searchParams.get("trackingNumber");

  if (!trackingNumber) {
    return new Response(JSON.stringify({ error: "trackingNumber is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const raw = await env.ORDERS.get(trackingNumber.toString());

    if (!raw) {
      return new Response(JSON.stringify({ success: false, error: "Order not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, data: JSON.parse(raw) }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

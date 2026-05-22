export async function onRequestGet(context) {
  const { request } = context;

  const url = new URL(request.url);
  const trackingNumber = url.searchParams.get("trackingNumber");

  if (!trackingNumber) {
    return new Response(JSON.stringify({ success: false, error: "trackingNumber is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const response = await fetch(
      `https://tracking.bosta.co/shipments/track/${encodeURIComponent(trackingNumber)}`,
      { headers: { "Content-Type": "application/json" } },
    );

    const result = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: "Bosta tracking API error",
        details: result,
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const data = result.data || result;

    const trackingEvents = data.trackingEvents?.map((e) => ({
      state: e.state || e.status || "",
      date: e.date || e.timestamp || "",
      notes: e.notes || e.exceptionReason || "",
    })) || [];

    const currentState = data.currentState?.state || data.state || data.status || "";

    return new Response(JSON.stringify({
      success: true,
      data: {
        trackingNumber,
        status: currentState,
        currentState: data.currentState?.state || data.currentState || data.status,
        trackingEvents,
        destination: data.destination?.toString() || data.receiver?.address || "",
        lastUpdate: data.lastUpdate || data.lastUpdated || "",
        promiseDate: data.promiseDate || "",
      },
    }), {
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

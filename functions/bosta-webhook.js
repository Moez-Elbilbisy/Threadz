const STATE_MAP = {
  10: "created", 11: "pending", 20: "in_transit",
  21: "in_transit", 22: "in_transit", 23: "in_transit",
  24: "in_transit", 25: "fulfilled", 30: "in_transit",
  40: "in_transit", 41: "out_for_delivery",
  45: "delivered", 46: "returned", 47: "exception",
  48: "terminated", 49: "cancelled", 60: "returned",
  100: "lost", 101: "damaged", 102: "investigation",
  103: "awaiting_action", 104: "archived", 105: "on_hold",
};

export async function onRequestPost(context) {
  const { request, env } = context;

  try {
    const payload = await request.json();
    const trackingNumber = payload.trackingNumber?.toString();
    const stateName = STATE_MAP[payload.state] || `unknown_${payload.state}`;

    console.log("Bosta Webhook:", { trackingNumber, state: payload.state, stateName });

    if (trackingNumber) {
      try {
        const raw = await env.ORDERS.get(trackingNumber.toString());

        if (raw) {
          const order = JSON.parse(raw);
          order.status = stateName;
          order.stateCode = payload.state;
          order.updatedAt = new Date().toISOString();
          order.isConfirmedDelivery = payload.isConfirmedDelivery;
          order.cod = payload.cod;

          if (!order.trackingEvents) order.trackingEvents = [];
          order.trackingEvents.unshift({
            state: stateName,
            stateCode: payload.state,
            notes: payload.exceptionReason || "",
            date: new Date(payload.timeStamp).toISOString(),
            timestamp: payload.timeStamp,
          });

          await env.ORDERS.put(trackingNumber.toString(), JSON.stringify(order));
        }
      } catch (kvErr) {
        console.error("KV update error:", kvErr);
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Bosta webhook parse error:", error);
    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
}

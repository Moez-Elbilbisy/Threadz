export async function onRequest(context) {
  try {
    if (context.request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    const { trackingNumber } = await context.request.json();

    if (!trackingNumber) {
      return new Response(JSON.stringify({
        success: false,
        error: "Missing tracking number"
      }), { status: 400 });
    }

    const raw = await context.env.ORDERS.get(trackingNumber);
    if (!raw) {
      return new Response(JSON.stringify({
        success: false,
        error: "Order not found"
      }), { status: 404 });
    }

    const order = JSON.parse(raw);
    console.log("ORDER:", order);

    if (order.status === "delivered") {
      return new Response(JSON.stringify({
        success: false,
        error: "Delivered orders cannot be cancelled"
      }), { status: 400 });
    }

    if (order.status === "cancelled") {
      return new Response(JSON.stringify({
        success: false,
        error: "Order is already cancelled"
      }), { status: 400 });
    }

    // Try cancelling on Bosta (non-blocking — local cancel always happens)
    if (order.shipmentId && context.env.BOSTA_API_KEY) {
      try {
        const bostaRes = await fetch(
          `https://app.bosta.co/api/v2/deliveries/${order.shipmentId}`,
          {
            method: "DELETE",
            headers: {
              Authorization: context.env.BOSTA_API_KEY,
            },
          }
        );
        const rawText = await bostaRes.text();
        console.log("BOSTA DELETE STATUS:", bostaRes.status);
        console.log("BOSTA DELETE RESPONSE:", rawText);
        order.bostaResponse = rawText;
        order.bostaStatus = bostaRes.status;
        order.bostaCancelled = bostaRes.ok;
      } catch (bostaErr) {
        console.error("Bosta delete network error:", bostaErr);
        order.bostaError = bostaErr.message;
      }
    }

    order.status = "cancelled";
    order.cancelledAt = new Date().toISOString();

    await context.env.ORDERS.put(trackingNumber, JSON.stringify(order));

    return new Response(JSON.stringify({
      success: true,
      message: "Order cancelled successfully",
      order
    }), {
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), { status: 500 });
  }
}

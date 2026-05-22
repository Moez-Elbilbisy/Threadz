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

    // Cancel in Bosta
    if (order.shipmentId && context.env.BOSTA_API_KEY) {
      const bostaRes = await fetch(
        `https://app.bosta.co/api/v2/deliveries/${order.shipmentId}/cancel-delivery`,
        {
          method: "POST",
          headers: {
            Authorization: context.env.BOSTA_API_KEY,
            "Content-Type": "application/json"
          }
        }
      );
      const rawText = await bostaRes.text();
      console.log("BOSTA STATUS:", bostaRes.status);
      console.log("BOSTA RESPONSE:", rawText);

      if (!bostaRes.ok) {
        return new Response(JSON.stringify({
          success: false,
          error: "Bosta cancellation failed",
          status: bostaRes.status,
          response: rawText
        }), { status: 500 });
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

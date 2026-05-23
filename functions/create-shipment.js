import { sendWhatsApp } from "./api/_utils.js";

export async function onRequestPost(context) {
  const { request, env } = context;

  const BOSTA_API_KEY = env.BOSTA_API_KEY;
  if (!BOSTA_API_KEY) {
    return new Response(JSON.stringify({ error: "BOSTA_API_KEY is missing" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const data = await request.json();

    const nameParts = (data.fullName || "").trim().split(" ");
    const firstName = nameParts[0] || "Customer";
    const lastName = nameParts.slice(1).join(" ") || "";

    const CITY_CODES = {
      Cairo: "EG-01", Alexandria: "EG-02", Giza: "EG-03",
      Qalyubia: "EG-04", Dakahlia: "EG-05", "Port Said": "EG-06",
      Suez: "EG-07", Damietta: "EG-08", Beheira: "EG-09",
      Gharbia: "EG-10", Menofia: "EG-11", Sharqia: "EG-12",
      Ismailia: "EG-13", "Kafr El Sheikh": "EG-14", Matrouh: "EG-15",
      Minya: "EG-16", Assiut: "EG-17", Luxor: "EG-18",
      "Red Sea": "EG-19", "New Valley": "EG-20", "Beni Suef": "EG-21",
      Fayoum: "EG-22", Aswan: "EG-23", Qena: "EG-24",
      Sohag: "EG-25", "South Sinai": "EG-26", "North Sinai": "EG-27",
      Helwan: "EG-28", "6th of October": "EG-29",
    };

    const cityCode = CITY_CODES[data.governorate] || data.governorate;

    const codAmount = data.paymentMethod === "cod" ? Number(data.total || 0) : 0;

    const shipmentBody = {
      type: 10,
      receiver: { firstName, lastName, phone: data.phone },
      dropOffAddress: {
        firstLine: data.street,
        buildingNumber: data.building,
        apartment: data.apartment,
        city: cityCode,
        zone: data.area,
      },
      pickupAddress: {
        firstLine: env.STORE_ADDRESS || "Threadz Store, Cairo",
        city: "EG-01",
      },
      specs: {
        packageDetails: {
          itemsCount: data.items?.length || 1,
          description: "Threadz Order",
        },
      },
      cod: codAmount,
      notes: data.notes || "",
      businessReference: `ORDER-${Date.now()}`,
    };

    const response = await fetch("https://app.bosta.co/api/v2/deliveries", {
      method: "POST",
      headers: {
        Authorization: BOSTA_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(shipmentBody),
    });

    const result = await response.json();

    console.log("Bosta Response:", JSON.stringify(result, null, 2));

    if (!response.ok) {
      return new Response(JSON.stringify({
        success: false,
        error: "Bosta API Error",
        details: result,
      }), {
        status: response.status,
        headers: { "Content-Type": "application/json" },
      });
    }

    const trackingNumber = result?.data?.referenceNumber || result?.data?.trackingNumber || result?.data?.fullTrackingNumber || result?.data?._id || result?._id;

    try {
      if (trackingNumber) {
        await env.ORDERS.put(trackingNumber.toString(), JSON.stringify({
          trackingNumber: trackingNumber.toString(),
          fullName: data.fullName,
          phone: data.phone,
          email: data.email || "",
          governorate: data.governorate,
          area: data.area,
          street: data.street,
          building: data.building,
          apartment: data.apartment,
          paymentMethod: data.paymentMethod,
          total: data.total,
          items: data.items || [],
          status: "created",
          createdAt: new Date().toISOString(),
          shipmentId: result?.data?._id,
        }));
        if (data.email) {
          const ords = JSON.parse((await env.ORDERS.get(`user-orders:${data.email.toLowerCase()}`)) || "[]");
          if (!ords.includes(trackingNumber.toString())) {
            ords.push(trackingNumber.toString());
            await env.ORDERS.put(`user-orders:${data.email.toLowerCase()}`, JSON.stringify(ords));
          }
        }
      }
    } catch (kvErr) {
      console.error("KV store error (non-fatal):", kvErr);
    }

    sendWhatsApp(env, data.phone, [data.fullName, trackingNumber, "EGP " + (data.total || 0), "https://threadzeg.pages.dev/track.html"]);

    return new Response(JSON.stringify({
      success: true,
      trackingNumber,
      shipmentId: result?.data?._id,
      data: result,
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

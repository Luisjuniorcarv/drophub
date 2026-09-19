import { NextRequest, NextResponse } from "next/server";
import { processPaymentWebhook } from "@/modules/payments/service";
import { PAYMENT_GATEWAYS } from "@/modules/payments/types";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    const result = await processPaymentWebhook({
      gatewayName: PAYMENT_GATEWAYS.MERCADO_PAGO,
      rawBody: rawBody || "{}",
      headers,
    });

    return NextResponse.json({
      received: true,
      result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message === "INVALID_WEBHOOK_SIGNATURE") {
      console.warn("[MERCADOPAGO_WEBHOOK] Assinatura HMAC inválida.");
      return NextResponse.json(
        { error: "Assinatura do webhook inválida." },
        { status: 401 }
      );
    }

    console.error("[MERCADOPAGO_WEBHOOK_ERROR]", error);
    // Para webhooks de gateway, respondemos 200 com flag de erro para evitar loops se for erro interno de parse
    return NextResponse.json(
      { received: true, error: error.message },
      { status: 200 }
    );
  }
}

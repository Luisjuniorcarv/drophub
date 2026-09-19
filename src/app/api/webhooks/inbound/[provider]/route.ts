import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/modules/automations/hmac";

interface Params {
  params: Promise<{ provider: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const { provider } = await params;
    const rawBody = await req.text();
    const signatureHeader =
      req.headers.get("x-drophub-signature") ||
      req.headers.get("x-webhook-signature") ||
      req.headers.get("x-signature");

    const secretEnvName = `INBOUND_WEBHOOK_SECRET_${provider.toUpperCase().replace(/[^A-Z0-9_]/g, "_")}`;
    const configuredSecret = process.env[secretEnvName] || process.env.INBOUND_WEBHOOK_SECRET;

    // Se houver segredo configurado, valida a assinatura HMAC
    if (configuredSecret && signatureHeader) {
      const isValid = verifyWebhookSignature(rawBody, configuredSecret, signatureHeader);
      if (!isValid) {
        console.warn(`[INBOUND_WEBHOOK_${provider.toUpperCase()}] Assinatura HMAC inválida.`);
        return NextResponse.json(
          { error: "Assinatura HMAC inválida para este webhook." },
          { status: 401 }
        );
      }
    }

    let parsedPayload: any = null;
    try {
      parsedPayload = JSON.parse(rawBody);
    } catch {
      parsedPayload = { raw: rawBody };
    }

    console.log(`[INBOUND_WEBHOOK_${provider.toUpperCase()}] Recebido com sucesso:`, {
      provider,
      timestamp: new Date().toISOString(),
      payloadSummary: typeof parsedPayload === "object" ? Object.keys(parsedPayload) : "raw",
    });

    return NextResponse.json({
      success: true,
      received: true,
      provider,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[API_INBOUND_WEBHOOK_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao processar webhook de entrada.", details: error.message },
      { status: 500 }
    );
  }
}

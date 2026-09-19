import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  updateFulfillmentTracking,
  markFulfillmentDelivered,
} from "@/modules/fulfillment/service";
import { SupplierWebhookSchema } from "@/lib/validators";

interface Props {
  params: Promise<{ provider: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    const { provider } = await props.params;
    const body = await req.json();

    const parseResult = SupplierWebhookSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Payload do webhook inválido.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { event, externalOrderId, supplierOrderNumber, trackingNumber, carrier, status, failureReason } =
      parseResult.data;

    // 1. Gravar registro de auditoria do Webhook recebido (Inbound)
    await prisma.webhookEvent.create({
      data: {
        eventType: `SUPPLIER_${event.toUpperCase()}`,
        source: `SUPPLIER_${provider.toUpperCase()}`,
        payloadJson: body,
        status: "RECEIVED",
      },
    });

    // 2. Localizar a FulfillmentOrder correspondente
    if (!externalOrderId && !supplierOrderNumber) {
      return NextResponse.json(
        { success: true, message: "Webhook registrado, nenhum identificador de ordem fornecido." },
        { status: 200 }
      );
    }

    const fulfillment = await prisma.fulfillmentOrder.findFirst({
      where: {
        OR: [
          ...(externalOrderId ? [{ externalOrderId }] : []),
          ...(supplierOrderNumber ? [{ supplierOrderNumber }] : []),
        ],
      },
    });

    if (!fulfillment) {
      return NextResponse.json(
        { success: true, message: "FulfillmentOrder não encontrada, ignorado idempotentemente." },
        { status: 200 }
      );
    }

    // 3. Processar transição de status conforme o evento
    if (event === "SHIPPED" || status === "SHIPPED") {
      if (trackingNumber) {
        await updateFulfillmentTracking(fulfillment.id, {
          carrier: carrier || "Correios",
          trackingNumber,
        });
      }
    } else if (event === "DELIVERED" || status === "DELIVERED") {
      await markFulfillmentDelivered(fulfillment.id);
    } else if (event === "FAILED" || status === "FAILED") {
      await prisma.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          status: "FAILED",
          failureReason: failureReason || "Falha reportada pelo webhook do fornecedor",
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: `Evento ${event} processado com sucesso para a ordem ${fulfillment.id}.`,
    });
  } catch (error: any) {
    console.error("[SUPPLIER_WEBHOOK_ERROR]", error);
    return NextResponse.json({ error: "Erro ao processar webhook do fornecedor." }, { status: 500 });
  }
}

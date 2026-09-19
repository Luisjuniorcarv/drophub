import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CreateShipmentSchema } from "@/lib/validators";
import { OrderStatus } from "@prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({ where: { id } });
    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CreateShipmentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do envio inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { carrier, trackingNumber, trackingUrl, supplierId, status } = parseResult.data;

    const autoTrackingUrl =
      trackingUrl ||
      `https://rastreamento.correios.com.br/app/index.php?codigo=${encodeURIComponent(trackingNumber)}`;

    const shipment = await prisma.$transaction(async (tx) => {
      const createdShipment = await tx.shipment.create({
        data: {
          orderId: id,
          carrier,
          trackingNumber,
          trackingUrl: autoTrackingUrl,
          supplierId: supplierId || null,
          status: status || "SHIPPED",
          shippedAt: new Date(),
          trackings: {
            create: {
              status: "POSTADO",
              description: `Objeto despachado via ${carrier}. Código: ${trackingNumber}`,
              location: "Centro de Distribuição do Fornecedor",
            },
          },
        },
        include: { trackings: true },
      });

      // Se o pedido ainda não estava com status SHIPPED, atualiza o status para SHIPPED
      if (order.status !== OrderStatus.SHIPPED && order.status !== OrderStatus.DELIVERED) {
        await tx.order.update({
          where: { id },
          data: { status: OrderStatus.SHIPPED },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            previousStatus: order.status,
            newStatus: OrderStatus.SHIPPED,
            reason: `Código de rastreamento ${trackingNumber} cadastrado via ${carrier}.`,
            changedByUserId: user.id,
          },
        });
      }

      return createdShipment;
    });

    return NextResponse.json({ success: true, shipment, data: shipment }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ORDER_SHIPMENT_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao cadastrar envio." }, { status: 500 });
  }
}

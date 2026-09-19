import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCustomerSession } from "@/modules/customer/auth";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const trackingToken = searchParams.get("token");

    const session = await getCustomerSession();

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        customerId: true,
        trackingToken: true,
        totalAmount: true,
        payments: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: {
            id: true,
            method: true,
            status: true,
            amount: true,
            qrCode: true,
            qrCodeBase64: true,
            paidAt: true,
            failureReason: true,
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const isOwner = session?.id && order.customerId === session.id;
    const hasToken = trackingToken && order.trackingToken === trackingToken;

    if (!isOwner && !hasToken) {
      return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      orderNumber: order.orderNumber,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      latestPayment: order.payments[0] || null,
    });
  } catch (error: any) {
    console.error("[STORE_ORDER_STATUS_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar status." }, { status: 500 });
  }
}

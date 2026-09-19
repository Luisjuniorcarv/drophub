import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: {
              select: {
                id: true,
                images: { where: { isCover: true }, take: 1 },
              },
            },
          },
        },
        payments: {
          orderBy: { createdAt: "desc" },
        },
        shipments: {
          include: {
            trackings: { orderBy: { timestamp: "desc" } },
            supplier: { select: { id: true, name: true } },
          },
        },
        statusHistory: {
          orderBy: { createdAt: "asc" },
          include: {
            changedByUser: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, order, data: order });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ORDER_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar pedido." }, { status: 500 });
  }
}

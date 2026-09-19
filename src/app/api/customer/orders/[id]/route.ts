import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/modules/customer/auth";
import { getStorefrontOrder } from "@/modules/storefront/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const trackingToken = searchParams.get("token");

    const session = await getCustomerSession();

    const order = await getStorefrontOrder({
      orderId: id,
      customerId: session?.id || null,
      trackingToken: trackingToken || null,
    });

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: any) {
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Acesso negado. Você não tem permissão para visualizar este pedido." },
        { status: 403 }
      );
    }
    console.error("[CUSTOMER_ORDER_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar pedido." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireCustomerAuth } from "@/modules/customer/auth";
import { listCustomerOrders } from "@/modules/storefront/service";

export async function GET(req: NextRequest) {
  try {
    const session = await requireCustomerAuth();

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 10));

    const result = await listCustomerOrders(session.id, page, limit);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED") {
      return NextResponse.json({ error: "Acesso não autorizado. Faça login para visualizar seus pedidos." }, { status: 401 });
    }
    console.error("[CUSTOMER_ORDERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar pedidos." }, { status: 500 });
  }
}

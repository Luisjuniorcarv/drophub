import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { listFulfillmentOrders, createFulfillmentsForOrder } from "@/modules/fulfillment/service";
import { CreateFulfillmentSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status") || undefined;
    const orderId = searchParams.get("orderId") || undefined;
    const supplierId = searchParams.get("supplierId") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 15));

    const result = await listFulfillmentOrders({
      status,
      orderId,
      supplierId,
      search,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    console.error("[API_FULFILLMENT_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar ordens de fulfillment." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = CreateFulfillmentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await createFulfillmentsForOrder(parseResult.data.orderId);

    return NextResponse.json(
      {
        success: true,
        message: `${result.totalFulfillments} ordem(ns) de fulfillment criada(s) com sucesso.`,
        data: result,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (error.message === "ORDER_NOT_PAID") {
      return NextResponse.json(
        { error: "Não é permitido criar fulfillment para pedidos que ainda não foram pagos." },
        { status: 400 }
      );
    }
    console.error("[API_FULFILLMENT_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar fulfillment." }, { status: 500 });
  }
}

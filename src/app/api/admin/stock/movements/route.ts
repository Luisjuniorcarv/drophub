import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { StockMovementFilterSchema } from "@/lib/validators";
import { listStockMovements } from "@/modules/stock";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const rawFilters = {
      productId: searchParams.get("productId") || undefined,
      variantId: searchParams.get("variantId") || undefined,
      orderId: searchParams.get("orderId") || undefined,
      type: searchParams.get("type") || undefined,
      page: searchParams.get("page") || 1,
      limit: searchParams.get("limit") || 50,
    };

    const parseResult = StockMovementFilterSchema.safeParse(rawFilters);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Filtros inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await listStockMovements(parseResult.data);

    return NextResponse.json({
      success: true,
      data: result.movements,
      pagination: result.pagination,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_STOCK_MOVEMENTS_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar movimentações de estoque." }, { status: 500 });
  }
}

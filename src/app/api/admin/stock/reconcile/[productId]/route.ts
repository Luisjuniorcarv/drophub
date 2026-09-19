import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { reconcileStock } from "@/modules/stock";

interface Params {
  params: Promise<{ productId: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { productId } = await params;
    const { searchParams } = new URL(req.url);
    const variantId = searchParams.get("variantId") || undefined;

    const result = await reconcileStock(productId, variantId);

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "PRODUCT_NOT_FOUND" || error.message === "VARIANT_NOT_FOUND") {
      return NextResponse.json({ error: "Produto ou variação não encontrado." }, { status: 404 });
    }
    console.error("[API_STOCK_RECONCILE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao reconciliar estoque." }, { status: 500 });
  }
}

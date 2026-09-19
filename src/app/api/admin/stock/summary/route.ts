import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getStockSummary } from "@/modules/stock";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const summary = await getStockSummary();

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_STOCK_SUMMARY_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar sumário de estoque." }, { status: 500 });
  }
}

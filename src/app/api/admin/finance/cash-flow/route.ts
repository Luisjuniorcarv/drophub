import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getCashFlow } from "@/modules/finance/service";
import { PeriodType } from "@/modules/finance/types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "30d") as PeriodType;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const cashFlow = await getCashFlow(period, startDate, endDate);

    return NextResponse.json({
      success: true,
      data: cashFlow,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_FINANCE_CASH_FLOW_ERROR]", error);
    return NextResponse.json({ error: "Erro ao gerar fluxo de caixa." }, { status: 500 });
  }
}

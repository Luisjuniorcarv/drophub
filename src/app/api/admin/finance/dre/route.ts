import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getFinancialDRE, getDailyFinancialSeries } from "@/modules/finance/service";
import { PeriodType } from "@/modules/finance/types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "30d") as PeriodType;
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const [dre, dailySeries] = await Promise.all([
      getFinancialDRE(period, startDate, endDate),
      getDailyFinancialSeries(period, startDate, endDate),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        ...dre,
        dailySeries,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_FINANCE_DRE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao calcular DRE financeiro." }, { status: 500 });
  }
}

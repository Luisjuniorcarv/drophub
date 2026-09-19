import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getFinancialDRE, getCashFlow } from "@/modules/finance/service";
import { PeriodType } from "@/modules/finance/types";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const period = (searchParams.get("period") || "30d") as PeriodType;

    const [dre, cashFlow] = await Promise.all([
      getFinancialDRE(period),
      getCashFlow(period),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        dre,
        cashFlow: {
          totalInflow: cashFlow.totalInflow,
          totalOutflow: cashFlow.totalOutflow,
          netCashBalance: cashFlow.netCashBalance,
        },
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_FINANCE_SUMMARY_ERROR]", error);
    return NextResponse.json({ error: "Erro ao gerar resumo financeiro." }, { status: 500 });
  }
}

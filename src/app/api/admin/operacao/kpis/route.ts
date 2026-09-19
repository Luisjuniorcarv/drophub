import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getOperationalDashboardKPIs } from "@/modules/fulfillment/service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const kpis = await getOperationalDashboardKPIs();

    return NextResponse.json({
      success: true,
      data: kpis,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    console.error("[API_OPERACAO_KPIS_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao carregar indicadores operacionais.", details: error.message },
      { status: 500 }
    );
  }
}

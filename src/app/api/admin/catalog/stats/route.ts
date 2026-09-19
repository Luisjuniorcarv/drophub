import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CatalogStatsService } from "@/modules/catalog/stats-service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const stats = await CatalogStatsService.getCatalogStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_STATS_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao carregar estatísticas do catálogo." },
      { status: 500 }
    );
  }
}

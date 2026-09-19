import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { AIService } from "@/modules/ai/service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get("limit") || "20", 10);

    const history = await AIService.getRecentInteractions(limit);

    return NextResponse.json({
      success: true,
      history,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ADMIN_AI_HISTORY_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao consultar histórico de IA." },
      { status: 500 }
    );
  }
}

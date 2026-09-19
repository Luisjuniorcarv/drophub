import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { processOutboxEvents } from "@/modules/automations/dispatcher";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    let limit = 20;
    try {
      const body = await req.json();
      if (body && typeof body.limit === "number") {
        limit = Math.min(100, Math.max(1, body.limit));
      }
    } catch {
      // Empty body is allowed, defaults to limit = 20
    }

    const result = await processOutboxEvents(limit);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Processamento da outbox concluído: ${result.processed} eventos analisados (${result.successful} sucessos, ${result.failed} pendentes/falhas).`,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_AUTOMATIONS_DISPATCH_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao processar fila de outbox.", details: error.message },
      { status: 500 }
    );
  }
}

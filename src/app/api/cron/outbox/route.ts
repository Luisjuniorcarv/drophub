import { NextRequest, NextResponse } from "next/server";
import { processOutboxEvents } from "@/modules/automations/dispatcher";
import { validateCronRequest } from "@/lib/cron-auth";

/**
 * Endpoint de Cron Automático para Processamento da Outbox
 * Protegido obrigatoriamente por CRON_SECRET via Bearer token ou x-cron-secret header.
 */
export async function GET(req: NextRequest) {
  return handleCronDispatch(req);
}

export async function POST(req: NextRequest) {
  return handleCronDispatch(req);
}

async function handleCronDispatch(req: NextRequest) {
  try {
    // Validação estrita e timing-safe de CRON_SECRET
    if (!validateCronRequest(req)) {
      return NextResponse.json(
        { error: "Não autorizado: CRON_SECRET ausente ou inválido." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const limitParam = Number(searchParams.get("limit")) || 50;
    const limit = Math.min(100, Math.max(1, limitParam));

    const result = await processOutboxEvents(limit);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      data: result,
      message: `Cron da Outbox executado: ${result.processed} eventos analisados (${result.successful} sucessos, ${result.failed} pendentes/falhas).`,
    });
  } catch (error: any) {
    console.error("[CRON_OUTBOX_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao processar cron da outbox.", details: error.message },
      { status: 500 }
    );
  }
}

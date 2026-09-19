import { NextRequest, NextResponse } from "next/server";
import { processFulfillmentJobs } from "@/modules/fulfillment/worker";
import { validateCronRequest } from "@/lib/cron-auth";

/**
 * Endpoint de Cron Automático para Retentativas e Sincronizações de Fulfillment
 * Protegido obrigatoriamente por CRON_SECRET via Bearer token ou x-cron-secret header.
 */
export async function GET(req: NextRequest) {
  return handleFulfillmentCron(req);
}

export async function POST(req: NextRequest) {
  return handleFulfillmentCron(req);
}

async function handleFulfillmentCron(req: NextRequest) {
  try {
    // Validação estrita e timing-safe de CRON_SECRET
    if (!validateCronRequest(req)) {
      return NextResponse.json(
        { error: "Não autorizado: CRON_SECRET ausente ou inválido." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const batchParam = Number(searchParams.get("batch")) || 20;
    const batchSize = Math.min(50, Math.max(1, batchParam));
    const syncSupplierStatus = searchParams.get("sync") !== "false";

    const result = await processFulfillmentJobs({
      batchSize,
      syncSupplierStatus,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Cron de fulfillment executado com sucesso: ${result.retried} retentativas (${result.retriesSucceeded} sucessos) e ${result.synced} sincronizações (${result.syncsUpdated} atualizações).`,
    });
  } catch (error: any) {
    console.error("[CRON_FULFILLMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao processar cron de fulfillment.", details: error.message },
      { status: 500 }
    );
  }
}

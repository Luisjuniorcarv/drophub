import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { redeliverWebhook } from "@/modules/automations/dispatcher";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const result = await redeliverWebhook(id);

    return NextResponse.json({
      success: result.result.success,
      data: result,
      message: result.result.success
        ? "Reenvio executado com sucesso."
        : `Falha no reenvio: ${result.result.errorMessage || "Status não OK"}`,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "Registro de entrega não encontrado.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[API_WEBHOOK_RETRY_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao reenviar entrega de webhook.", details: error.message },
      { status: 500 }
    );
  }
}

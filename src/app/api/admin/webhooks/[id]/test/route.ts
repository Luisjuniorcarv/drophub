import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { testWebhookEndpoint } from "@/modules/automations/dispatcher";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const result = await testWebhookEndpoint(id);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.success
        ? "Webhook respondeu com sucesso ao teste de conectividade."
        : `Falha ao testar webhook: ${result.errorMessage || "Status não OK"}`,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "Webhook não encontrado.") {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("[API_WEBHOOK_TEST_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao disparar teste de webhook.", details: error.message },
      { status: 500 }
    );
  }
}

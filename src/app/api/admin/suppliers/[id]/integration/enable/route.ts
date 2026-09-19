import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { SupplierIntegrationManager } from "@/modules/suppliers/integration-manager";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/suppliers/:id/integration/enable
 * Ativa a integração de um fornecedor
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const integration = await SupplierIntegrationManager.enableIntegration(id);

    return NextResponse.json({
      success: true,
      integration,
      message: "Integração ativada com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message?.includes("INTEGRATION_NOT_FOUND")) {
      return NextResponse.json({ error: "Integração não encontrada para este fornecedor." }, { status: 404 });
    }
    if (
      error.message?.includes("CANNOT_ENABLE") ||
      error.message?.includes("SSRF_BLOCKED")
    ) {
      return NextResponse.json(
        { error: error.message.split(": ")[1] || error.message },
        { status: 422 }
      );
    }
    console.error("[API_SUPPLIER_INTEGRATION_ENABLE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao ativar integração do fornecedor." }, { status: 500 });
  }
}

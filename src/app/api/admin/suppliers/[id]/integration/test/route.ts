import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { SupplierIntegrationManager } from "@/modules/suppliers/integration-manager";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/admin/suppliers/:id/integration/test
 * Executa teste seguro de conectividade e credenciais com o fornecedor
 */
export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const result = await SupplierIntegrationManager.testConnection(id);

    if (result.success) {
      return NextResponse.json({
        success: true,
        status: "CONNECTED",
        message: result.message || "Conexão com o fornecedor validada com sucesso.",
      });
    }

    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        error: result.errorMessage || "Falha na validação de conexão com o fornecedor.",
        category: result.category || "UNKNOWN_ERROR",
      },
      { status: 422 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_INTEGRATION_TEST_ERROR]", error);
    return NextResponse.json(
      {
        success: false,
        status: "FAILED",
        error: "Erro interno ao executar teste de conexão.",
      },
      { status: 500 }
    );
  }
}

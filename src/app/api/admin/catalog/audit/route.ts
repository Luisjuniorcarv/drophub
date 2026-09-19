import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CatalogAuditService } from "@/modules/catalog/audit-service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const productId = searchParams.get("productId") || undefined;
    const field = searchParams.get("field") || undefined;
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;

    const result = await CatalogAuditService.getGlobalAuditHistory({
      productId,
      field,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_AUDIT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao listar histórico de auditoria do catálogo." },
      { status: 500 }
    );
  }
}

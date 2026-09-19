import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CatalogImportCommitInputSchema } from "@/lib/validators";
import { CatalogImportService } from "@/modules/catalog/import-service";

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const body = await req.json();
    const parseResult = CatalogImportCommitInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do lote de importação inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { importBatchId, items, updateExisting, syncStockLedger } = parseResult.data;

    const commitResult = await CatalogImportService.commit({
      importBatchId,
      items,
      updateExisting,
      syncStockLedger,
      userId: authUser.id,
    });

    return NextResponse.json({
      success: commitResult.success,
      result: commitResult,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_IMPORT_COMMIT_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao executar importação." },
      { status: 500 }
    );
  }
}

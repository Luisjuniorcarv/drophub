import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CatalogImportPreviewInputSchema } from "@/lib/validators";
import { CatalogImportService } from "@/modules/catalog/import-service";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = CatalogImportPreviewInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Parâmetros de importação inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { format, rawData, supplierId, defaultStatus } = parseResult.data;

    const preview = await CatalogImportService.preview({
      format,
      rawData,
      supplierId,
      defaultStatus: defaultStatus as any,
    });

    return NextResponse.json({
      success: true,
      preview,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_IMPORT_PREVIEW_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar pré-visualização da importação." },
      { status: 400 }
    );
  }
}

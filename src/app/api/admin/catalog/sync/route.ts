import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CatalogSyncService } from "@/modules/catalog/sync-service";
import { z } from "zod";

const SyncRequestSchema = z.object({
  supplierProductId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  updateCommercialStock: z.boolean().default(false),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = SyncRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Parâmetros de sincronização inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { supplierProductId, productId, updateCommercialStock } = parseResult.data;

    if (!supplierProductId && !productId) {
      return NextResponse.json(
        { error: "Informe supplierProductId ou productId para sincronização." },
        { status: 400 }
      );
    }

    if (supplierProductId) {
      const result = await CatalogSyncService.syncSupplierProduct(supplierProductId, {
        updateProductCommercialStock: updateCommercialStock,
      });

      return NextResponse.json({
        success: result.success,
        result,
      });
    }

    if (productId) {
      const results = await CatalogSyncService.syncProductSuppliers(productId, {
        updateProductCommercialStock: updateCommercialStock,
      });

      return NextResponse.json({
        success: results.some((r) => r.success),
        results,
      });
    }
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_SYNC_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao executar sincronização." },
      { status: 500 }
    );
  }
}

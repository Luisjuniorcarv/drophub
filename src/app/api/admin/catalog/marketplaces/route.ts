import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import {
  MarketplacePublishRequestSchema,
  MarketplaceSyncRequestSchema,
} from "@/lib/validators";
import { CatalogMarketplaceManager } from "@/modules/catalog/marketplace-manager";
import { z } from "zod";

const ActionSchema = z.object({
  action: z.enum(["PUBLISH", "UNPUBLISH", "SYNC"]),
});

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const actionResult = ActionSchema.safeParse(body);

    if (!actionResult.success) {
      return NextResponse.json(
        { error: "Ação de marketplace inválida (PUBLISH, UNPUBLISH ou SYNC)." },
        { status: 400 }
      );
    }

    const { action } = actionResult.data;

    if (action === "PUBLISH") {
      const parseResult = MarketplacePublishRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: "Dados de publicação inválidos.",
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { productId, channels, customPrice, customStock } = parseResult.data;
      const result = await CatalogMarketplaceManager.publishProduct({
        productId,
        channels,
        customPrice,
        customStock,
      });

      return NextResponse.json({ success: true, result });
    }

    if (action === "UNPUBLISH") {
      const { productId, channels } = body;
      if (!productId || !channels || !Array.isArray(channels)) {
        return NextResponse.json(
          { error: "productId e canais são obrigatórios para despublicação." },
          { status: 400 }
        );
      }

      const result = await CatalogMarketplaceManager.unpublishProduct({
        productId,
        channels,
      });

      return NextResponse.json({ success: true, result });
    }

    if (action === "SYNC") {
      const parseResult = MarketplaceSyncRequestSchema.safeParse(body);
      if (!parseResult.success) {
        return NextResponse.json(
          {
            error: "Dados de sincronização inválidos.",
            details: parseResult.error.flatten().fieldErrors,
          },
          { status: 400 }
        );
      }

      const { productId } = parseResult.data;
      const result = await CatalogMarketplaceManager.syncPriceAndStock(productId);

      return NextResponse.json({ success: true, result });
    }
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_MARKETPLACE_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao processar operação de marketplace." },
      { status: 500 }
    );
  }
}

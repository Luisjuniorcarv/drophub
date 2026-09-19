import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { MarketplaceSyncService } from "@/modules/marketplaces/sync-service";
import { MarketplaceChannel } from "@/modules/marketplaces/types";

export class CatalogMarketplaceManager {
  /**
   * Publica um produto em um ou mais canais de marketplace
   */
  static async publishProduct(params: {
    productId: string;
    channels: (MarketplaceChannel | string)[];
    customPrice?: number;
    customStock?: number;
  }) {
    const product = await prisma.product.findUnique({
      where: { id: params.productId },
      include: {
        images: { orderBy: { position: "asc" } },
        category: true,
      },
    });

    if (!product) {
      throw new Error(`Produto com ID ${params.productId} não encontrado.`);
    }

    const price = params.customPrice ?? Number(product.sellingPrice);
    const stock = params.customStock ?? product.stock;

    const syncSummary = await MarketplaceSyncService.syncProductToChannels(
      {
        productId: product.id,
        sku: product.sku,
        title: product.name,
        description: product.description,
        price,
        stock,
        images: product.images.map((img) => img.url),
        category: product.category?.name,
        brand: product.brand || undefined,
      },
      params.channels
    );

    const now = new Date();

    // Persiste ou atualiza o status de cada listing no banco
    for (const res of syncSummary.results) {
      const listingStatus = res.success ? "ACTIVE" : res.errorMessage?.includes("NOT_CONFIGURED") ? "NOT_CONFIGURED" : "FAILED";

      await prisma.marketplaceListing.upsert({
        where: {
          productId_channel: {
            productId: product.id,
            channel: String(res.channel),
          },
        },
        update: {
          externalListingId: res.externalListingId || null,
          status: listingStatus,
          marketplacePrice: new Decimal(price),
          marketplaceStock: stock,
          lastSyncedAt: now,
          syncError: res.success ? null : res.errorMessage || "Falha na sincronização",
        },
        create: {
          productId: product.id,
          channel: String(res.channel),
          externalListingId: res.externalListingId || null,
          status: listingStatus,
          marketplacePrice: new Decimal(price),
          marketplaceStock: stock,
          lastSyncedAt: now,
          syncError: res.success ? null : res.errorMessage || "Falha na sincronização",
        },
      });
    }

    return syncSummary;
  }

  /**
   * Despublica / Pausa um produto em canais de marketplace
   */
  static async unpublishProduct(params: {
    productId: string;
    channels: (MarketplaceChannel | string)[];
  }) {
    const now = new Date();

    for (const channel of params.channels) {
      await prisma.marketplaceListing.updateMany({
        where: {
          productId: params.productId,
          channel: String(channel),
        },
        data: {
          status: "PAUSED",
          lastSyncedAt: now,
        },
      });
    }

    return {
      productId: params.productId,
      channelsUpdated: params.channels,
      status: "PAUSED",
    };
  }

  /**
   * Sincroniza preço e estoque atuais do produto com os canais publicados
   */
  static async syncPriceAndStock(productId: string) {
    const product = await prisma.product.findUnique({
      where: { id: productId },
      include: {
        marketplaceListings: {
          where: { status: { in: ["ACTIVE", "TEST"] } },
        },
      },
    });

    if (!product || product.marketplaceListings.length === 0) {
      return { channelsUpdated: 0, results: [] };
    }

    const price = Number(product.sellingPrice);
    const stock = product.stock;

    const externalListings = product.marketplaceListings.map((ml) => ({
      channel: ml.channel,
      listingId: ml.externalListingId || ml.id,
    }));

    const priceResults = await MarketplaceSyncService.syncPriceToChannels({
      sku: product.sku,
      externalListings,
      newPrice: price,
    });

    const stockResults = await MarketplaceSyncService.syncStockToChannels({
      sku: product.sku,
      externalListings,
      newStock: stock,
    });

    const now = new Date();
    for (const ml of product.marketplaceListings) {
      await prisma.marketplaceListing.update({
        where: { id: ml.id },
        data: {
          marketplacePrice: new Decimal(price),
          marketplaceStock: stock,
          lastSyncedAt: now,
        },
      });
    }

    return {
      channelsUpdated: externalListings.length,
      priceResults,
      stockResults,
    };
  }
}

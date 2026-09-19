import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { CatalogMarketplaceManager } from "@/modules/catalog/marketplace-manager";

describe("ETAPA 14 — Marketplace Preparation & Channel Listing Integration Tests", () => {
  const timestamp = Date.now();
  let testProduct: any;

  beforeAll(async () => {
    testProduct = await prisma.product.create({
      data: {
        name: "Produto Preparado para Marketplace",
        slug: `prod-mkt-${timestamp}`,
        sku: `SKU-MKT-${timestamp}`,
        description: "Descrição marketplace",
        costPrice: new Decimal("40.00"),
        sellingPrice: new Decimal("99.90"),
        stock: 35,
        brand: "DropHub Oficial",
      },
    });
  });

  afterAll(async () => {
    await prisma.marketplaceListing.deleteMany({ where: { productId: testProduct.id } });
    await prisma.product.deleteMany({ where: { id: testProduct.id } });
  });

  it("1. should publish product to TEST channel and record MarketplaceListing as ACTIVE", async () => {
    const summary = await CatalogMarketplaceManager.publishProduct({
      productId: testProduct.id,
      channels: ["TEST"],
      customPrice: 109.9,
    });

    expect(summary.channelsAttempted).toBe(1);
    expect(summary.channelsSucceeded).toBe(1);

    const listing = await prisma.marketplaceListing.findUnique({
      where: {
        productId_channel: {
          productId: testProduct.id,
          channel: "TEST",
        },
      },
    });

    expect(listing).toBeDefined();
    expect(listing?.status).toBe("ACTIVE");
    expect(Number(listing?.marketplacePrice)).toBe(109.9);
    expect(listing?.externalListingId).toBeDefined();
  });

  it("2. should handle unconfigured official channels safely (NOT_CONFIGURED status)", async () => {
    const summary = await CatalogMarketplaceManager.publishProduct({
      productId: testProduct.id,
      channels: ["SHOPEE", "MERCADO_LIVRE", "AMAZON"],
    });

    expect(summary.channelsAttempted).toBe(3);

    const listings = await prisma.marketplaceListing.findMany({
      where: { productId: testProduct.id },
    });

    const shopeeListing = listings.find((l) => l.channel === "SHOPEE");
    expect(shopeeListing).toBeDefined();
    expect(shopeeListing?.status).toBe("NOT_CONFIGURED");
  });

  it("3. should unpublish/pause marketplace listing", async () => {
    const res = await CatalogMarketplaceManager.unpublishProduct({
      productId: testProduct.id,
      channels: ["TEST"],
    });

    expect(res.status).toBe("PAUSED");

    const listing = await prisma.marketplaceListing.findUnique({
      where: {
        productId_channel: {
          productId: testProduct.id,
          channel: "TEST",
        },
      },
    });

    expect(listing?.status).toBe("PAUSED");
  });
});

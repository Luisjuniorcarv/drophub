import { describe, it, expect, beforeEach } from "vitest";
import { MarketplaceSyncService } from "@/modules/marketplaces/sync-service";
import { TestMarketplaceAdapter } from "@/modules/marketplaces/adapters/test-marketplace-adapter";
import { setGlobalTestMarketplaceAdapter } from "@/modules/marketplaces/factory";

describe("ETAPA 12 — Marketplace Sync Service Integration Tests", () => {
  let testAdapter: TestMarketplaceAdapter;

  beforeEach(() => {
    testAdapter = new TestMarketplaceAdapter();
    setGlobalTestMarketplaceAdapter(testAdapter);
  });

  it("1. should sync product to multiple channels safely", async () => {
    const summary = await MarketplaceSyncService.syncProductToChannels(
      {
        productId: "p1",
        sku: "SKU-PROD-TEST",
        title: "Produto de Teste",
        description: "Descrição",
        price: 89.9,
        stock: 30,
        images: [],
      },
      ["TEST"]
    );

    expect(summary.channelsAttempted).toBe(1);
    expect(summary.channelsSucceeded).toBe(1);
    expect(summary.results[0].status).toBe("ACTIVE");
  });

  it("2. should sync price and stock updates across channels", async () => {
    const priceRes = await MarketplaceSyncService.syncPriceToChannels({
      sku: "SKU-PROD-TEST",
      externalListings: [{ channel: "TEST", listingId: "lst-01" }],
      newPrice: 99.9,
    });
    expect(priceRes[0].success).toBe(true);

    const stockRes = await MarketplaceSyncService.syncStockToChannels({
      sku: "SKU-PROD-TEST",
      externalListings: [{ channel: "TEST", listingId: "lst-01" }],
      newStock: 15,
    });
    expect(stockRes[0].success).toBe(true);
  });

  it("3. channel error in unconfigured marketplace should not crash sync service", async () => {
    const summary = await MarketplaceSyncService.syncProductToChannels(
      {
        productId: "p1",
        sku: "SKU-FAIL",
        title: "Produto",
        description: "Desc",
        price: 50,
        stock: 10,
        images: [],
      },
      ["TEST", "SHOPEE"]
    );

    expect(summary.channelsAttempted).toBe(2);
    expect(summary.channelsSucceeded).toBe(1); // TEST succeeds, SHOPEE fails gracefully
    expect(summary.results.find((r) => r.channel === "SHOPEE")?.status).toBe("FAILED");
  });
});

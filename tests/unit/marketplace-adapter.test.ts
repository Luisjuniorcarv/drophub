import { describe, it, expect, beforeEach } from "vitest";
import { TestMarketplaceAdapter } from "@/modules/marketplaces/adapters/test-marketplace-adapter";
import {
  getMarketplaceAdapter,
  getTestMarketplaceAdapter,
  setGlobalTestMarketplaceAdapter,
} from "@/modules/marketplaces/factory";
import { ShopeeAdapter } from "@/modules/marketplaces/adapters/shopee-adapter";
import { MercadoLivreAdapter } from "@/modules/marketplaces/adapters/mercadolivre-adapter";
import { AmazonAdapter } from "@/modules/marketplaces/adapters/amazon-adapter";

describe("ETAPA 12 — MarketplaceAdapter & Factory Unit Tests", () => {
  let adapter: TestMarketplaceAdapter;

  beforeEach(() => {
    adapter = new TestMarketplaceAdapter();
    setGlobalTestMarketplaceAdapter(adapter);
  });

  it("1. should resolve correct adapters via factory", () => {
    expect(getMarketplaceAdapter("TEST")).toBeInstanceOf(TestMarketplaceAdapter);
    expect(getMarketplaceAdapter("SHOPEE")).toBeInstanceOf(ShopeeAdapter);
    expect(getMarketplaceAdapter("MERCADO_LIVRE")).toBeInstanceOf(MercadoLivreAdapter);
    expect(getMarketplaceAdapter("AMAZON")).toBeInstanceOf(AmazonAdapter);
  });

  it("2. should publish product in test marketplace", async () => {
    const res = await adapter.publishProduct({
      product: {
        productId: "prod-1",
        sku: "SKU-SHIRT-BLK-M",
        title: "Camiseta Algodão",
        description: "Camiseta preta",
        price: 79.9,
        stock: 50,
        images: ["https://example.com/image.jpg"],
      },
    });

    expect(res.success).toBe(true);
    expect(res.status).toBe("ACTIVE");
    expect(res.externalListingId).toBeDefined();
    expect(adapter.getListing("SKU-SHIRT-BLK-M")?.price).toBe(79.9);
  });

  it("3. should update price and stock in marketplace", async () => {
    await adapter.publishProduct({
      product: {
        productId: "prod-1",
        sku: "SKU-MUG-01",
        title: "Caneca",
        description: "Caneca",
        price: 39.9,
        stock: 10,
        images: [],
      },
    });

    const priceRes = await adapter.updatePrice({
      externalListingId: "lst-01",
      sku: "SKU-MUG-01",
      price: 49.9,
    });
    expect(priceRes.success).toBe(true);
    expect(adapter.getListing("SKU-MUG-01")?.price).toBe(49.9);

    const stockRes = await adapter.updateStock({
      externalListingId: "lst-01",
      sku: "SKU-MUG-01",
      stock: 25,
    });
    expect(stockRes.success).toBe(true);
    expect(adapter.getListing("SKU-MUG-01")?.stock).toBe(25);
  });

  it("4. should get marketplace order details", async () => {
    const res = await adapter.getOrder({ externalOrderId: "ORD-MKT-99" });
    expect(res.success).toBe(true);
    expect(res.items.length).toBeGreaterThan(0);
    expect(res.totalAmount).toBeGreaterThan(0);
    expect(res.recipient.name).toBeDefined();
  });

  it("5. should sync marketplace orders batch", async () => {
    const res = await adapter.syncOrders({ limit: 10 });
    expect(res.success).toBe(true);
    expect(res.orders.length).toBe(1);
    expect(res.totalSynced).toBe(1);
  });

  it("6. should throw NOT_CONFIGURED when real marketplace lacks credentials", async () => {
    const shopee = new ShopeeAdapter({ partnerId: "", partnerKey: "", shopId: "" });
    await expect(shopee.publishProduct({ product: {} as any })).rejects.toThrow(
      "SHOPEE_NOT_CONFIGURED"
    );

    const meli = new MercadoLivreAdapter({ appId: "", secretKey: "" });
    await expect(meli.publishProduct({ product: {} as any })).rejects.toThrow(
      "MERCADOLIVRE_NOT_CONFIGURED"
    );

    const amazon = new AmazonAdapter({ clientId: "", clientSecret: "", sellerId: "" });
    await expect(amazon.publishProduct({ product: {} as any })).rejects.toThrow(
      "AMAZON_NOT_CONFIGURED"
    );
  });
});

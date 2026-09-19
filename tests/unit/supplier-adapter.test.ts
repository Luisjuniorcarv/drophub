import { describe, it, expect, beforeEach } from "vitest";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { getSupplierAdapter, setGlobalTestSupplierAdapter } from "@/modules/suppliers/factory";
import { FulfillmentStatus } from "@prisma/client";

describe("ETAPA 12 — SupplierAdapter & TestSupplierAdapter Unit Tests", () => {
  let adapter: TestSupplierAdapter;

  beforeEach(() => {
    adapter = new TestSupplierAdapter({ delayMs: 0 });
    setGlobalTestSupplierAdapter(adapter);
  });

  it("1. should fetch supplier catalog of products successfully", async () => {
    const result = await adapter.getProducts({ page: 1, limit: 10 });
    expect(result.success).toBe(true);
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0]).toHaveProperty("sku");
    expect(result.products[0]).toHaveProperty("costPrice");
  });

  it("2. should fetch realtime stock for requested SKUs", async () => {
    const result = await adapter.getStock({ skus: ["SKU-SHIRT-BLK-M", "SKU-OUT-OF-STOCK"] });
    expect(result.success).toBe(true);
    expect(result.items).toHaveLength(2);

    const availableItem = result.items.find((i) => i.sku === "SKU-SHIRT-BLK-M");
    const outOfStockItem = result.items.find((i) => i.sku === "SKU-OUT-OF-STOCK");

    expect(availableItem?.stock).toBe(75);
    expect(availableItem?.isAvailable).toBe(true);
    expect(outOfStockItem?.stock).toBe(0);
    expect(outOfStockItem?.isAvailable).toBe(false);
  });

  it("3. should fetch realtime cost prices for SKUs", async () => {
    const result = await adapter.getPrice({ skus: ["SKU-SHIRT-BLK-M"] });
    expect(result.success).toBe(true);
    expect(result.items[0].costPrice).toBe(29.9);
    expect(result.items[0].currency).toBe("BRL");
  });

  it("4. should create supplier order successfully", async () => {
    const result = await adapter.createOrder({
      fulfillmentOrderId: "ful-123",
      orderNumber: "DH-9999",
      supplierId: "sup-01",
      supplierName: "Fornecedor Teste",
      recipient: {
        name: "Carlos Teste",
        street: "Rua Teste",
        city: "São Paulo",
        state: "SP",
        postalCode: "01000-000",
      },
      items: [{ sku: "SKU-SHIRT-BLK-M", name: "Camiseta", quantity: 2, unitCost: 28.5 }],
    });

    expect(result.success).toBe(true);
    expect(result.status).toBe("ACKNOWLEDGED");
    expect(result.externalOrderId).toBeDefined();
    expect(result.supplierOrderNumber).toBeDefined();
  });

  it("5. should fetch order details and tracking info", async () => {
    adapter.setSimulatedStatus(FulfillmentStatus.SHIPPED);
    adapter.setCustomTracking("BR987654321DH", "Correios SEDEX");

    const orderRes = await adapter.getOrder({ externalOrderId: "EXT-123" });
    expect(orderRes.success).toBe(true);
    expect(orderRes.status).toBe(FulfillmentStatus.SHIPPED);
    expect(orderRes.trackingNumber).toBe("BR987654321DH");

    const trackRes = await adapter.getTracking({ externalOrderId: "EXT-123" });
    expect(trackRes.success).toBe(true);
    expect(trackRes.trackingNumber).toBe("BR987654321DH");
    expect(trackRes.carrier).toBe("Correios SEDEX");
    expect(trackRes.events?.length).toBeGreaterThan(0);
  });

  it("6. should cancel order successfully", async () => {
    const result = await adapter.cancelOrder({
      externalOrderId: "EXT-123",
      reason: "Cancelamento solicitado pelo cliente",
    });

    expect(result.success).toBe(true);
    expect(result.cancelled).toBe(true);
  });

  it("7. should handle failure simulation and errors gracefully", async () => {
    adapter.setShouldFail(true, "API externa temporariamente indisponível");

    const result = await adapter.getProducts();
    expect(result.success).toBe(false);
    expect(result.errorMessage).toContain("API externa temporariamente indisponível");
  });

  it("8. should handle timeout simulation", async () => {
    adapter.setSimulateTimeout(true);

    await expect(adapter.getProducts()).rejects.toThrow("SUPPLIER_TIMEOUT");
  });

  it("9. should handle transient failure until retry succeeds", async () => {
    adapter.setFailUntilAttempts(2, "Erro temporário de conexão");

    // Tentativa 1: falha
    await expect(adapter.getStock({ skus: ["SKU-01"] })).rejects.toThrow("SUPPLIER_TRANSIENT_ERROR");

    // Tentativa 2: falha
    await expect(adapter.getStock({ skus: ["SKU-01"] })).rejects.toThrow("SUPPLIER_TRANSIENT_ERROR");

    // Tentativa 3: sucesso
    const res = await adapter.getStock({ skus: ["SKU-01"] });
    expect(res.success).toBe(true);
    expect(adapter.getAttemptCount()).toBe(3);
  });
});

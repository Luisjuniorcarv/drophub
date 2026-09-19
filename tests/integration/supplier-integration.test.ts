import { describe, it, expect, beforeEach } from "vitest";
import { SupplierIntegrationService, executeWithRetry } from "@/modules/suppliers/service";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { setGlobalTestSupplierAdapter } from "@/modules/suppliers/factory";

describe("ETAPA 12 — Supplier Integration Service Integration Tests", () => {
  let testAdapter: TestSupplierAdapter;

  beforeEach(() => {
    testAdapter = new TestSupplierAdapter({ delayMs: 0 });
    setGlobalTestSupplierAdapter(testAdapter);
  });

  it("1. should execute supplier catalog fetch via integration service", async () => {
    const res = await SupplierIntegrationService.fetchSupplierCatalog("TEST", { limit: 5 });
    expect(res.success).toBe(true);
    expect(res.products.length).toBeGreaterThan(0);
  });

  it("2. should verify realtime stock and price via integration service", async () => {
    const stockRes = await SupplierIntegrationService.checkRealtimeStock("TEST", {
      skus: ["SKU-SHIRT-BLK-M"],
    });
    expect(stockRes.success).toBe(true);
    expect(stockRes.items[0].stock).toBe(75);

    const priceRes = await SupplierIntegrationService.checkRealtimePrice("TEST", {
      skus: ["SKU-SHIRT-BLK-M"],
    });
    expect(priceRes.success).toBe(true);
    expect(priceRes.items[0].costPrice).toBe(29.9);
  });

  it("3. should submit order and query tracking with resilient retry", async () => {
    const orderRes = await SupplierIntegrationService.submitOrder("TEST", {
      fulfillmentOrderId: "ful-test",
      orderNumber: "DH-1001",
      supplierId: "sup-01",
      supplierName: "Test Supplier",
      recipient: {
        name: "João Silva",
        street: "Rua das Flores",
        city: "Curitiba",
        state: "PR",
        postalCode: "80000-000",
      },
      items: [{ sku: "SKU-SHIRT-BLK-M", name: "Camiseta", quantity: 1, unitCost: 28.5 }],
    });

    expect(orderRes.success).toBe(true);
    expect(orderRes.status).toBe("ACKNOWLEDGED");

    const trackRes = await SupplierIntegrationService.getTrackingInfo("TEST", {
      externalOrderId: orderRes.externalOrderId!,
    });
    expect(trackRes.success).toBe(true);
    expect(trackRes.trackingNumber).toBeDefined();
  });

  it("4. retry utility should recover from transient failures automatically", async () => {
    let attempts = 0;
    const failingOp = async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("Erro de rede temporário");
      }
      return "SUCCESS_DATA";
    };

    const result = await executeWithRetry(failingOp, { maxRetries: 3, initialDelayMs: 5 });
    expect(result).toBe("SUCCESS_DATA");
    expect(attempts).toBe(3);
  });
});

import { describe, it, expect } from "vitest";
import { SupplierProductSyncPayloadSchema } from "@/lib/validators";

describe("ETAPA 14 — Catalog Sync Resilience & Corruption Protection Unit Tests", () => {
  it("1. should accept valid supplier payload with positive cost and stock", () => {
    const validPayload = {
      costPrice: 42.5,
      stock: 150,
      isAvailable: true,
      name: "Produto Fornecedor Válido",
      suggestedPrice: 99.9,
    };

    const res = SupplierProductSyncPayloadSchema.safeParse(validPayload);
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.costPrice).toBe(42.5);
      expect(res.data.stock).toBe(150);
    }
  });

  it("2. should reject corrupt payload with negative cost or negative stock", () => {
    const negativeCostPayload = {
      costPrice: -10.0,
      stock: 50,
      isAvailable: true,
    };
    const resCost = SupplierProductSyncPayloadSchema.safeParse(negativeCostPayload);
    expect(resCost.success).toBe(false);

    const negativeStockPayload = {
      costPrice: 50.0,
      stock: -5,
      isAvailable: true,
    };
    const resStock = SupplierProductSyncPayloadSchema.safeParse(negativeStockPayload);
    expect(resStock.success).toBe(false);
  });

  it("3. should reject non-numeric or NaN values in sync payload", () => {
    const invalidTypes = {
      costPrice: "gratis" as any,
      stock: null as any,
    };
    const res = SupplierProductSyncPayloadSchema.safeParse(invalidTypes);
    expect(res.success).toBe(false);
  });
});

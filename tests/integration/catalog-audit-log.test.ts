import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { CatalogAuditService } from "@/modules/catalog/audit-service";
import { ProductStatus } from "@prisma/client";

describe("ETAPA 14 — Catalog Audit Log & Change Tracking Integration Tests", () => {
  const timestamp = Date.now();
  let testUser: any;
  let testProduct: any;

  beforeAll(async () => {
    testUser = await prisma.user.create({
      data: {
        name: `Admin Audit ${timestamp}`,
        email: `admin_audit_${timestamp}@drophub.com`,
        passwordHash: "hash_teste_12345",
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: "Produto Auditavel",
        slug: `prod-aud-${timestamp}`,
        sku: `SKU-AUD-${timestamp}`,
        description: "Descricao inicial",
        costPrice: new Decimal("50.00"),
        sellingPrice: new Decimal("120.00"),
        stock: 30,
        status: ProductStatus.DRAFT,
      },
    });
  });

  afterAll(async () => {
    await prisma.productAuditLog.deleteMany({ where: { productId: testProduct.id } });
    await prisma.product.deleteMany({ where: { id: testProduct.id } });
    await prisma.user.deleteMany({ where: { id: testUser.id } });
  });

  it("1. should record change in ProductAuditLog when price changes", async () => {
    const oldPrice = "120.00";
    const newPrice = "149.90";

    await CatalogAuditService.recordChange({
      productId: testProduct.id,
      field: "SELLING_PRICE",
      oldValue: oldPrice,
      newValue: newPrice,
      changedByUserId: testUser.id,
      reason: "Reajuste comercial de margem",
    });

    const logs = await CatalogAuditService.getProductAuditHistory(testProduct.id);
    expect(logs.length).toBeGreaterThanOrEqual(1);

    const priceLog = logs.find((l) => l.field === "SELLING_PRICE");
    expect(priceLog).toBeDefined();
    expect(priceLog?.oldValue).toBe(oldPrice);
    expect(priceLog?.newValue).toBe(newPrice);
    expect(priceLog?.reason).toBe("Reajuste comercial de margem");
    expect(priceLog?.user?.email).toBe(testUser.email);
  });

  it("2. should not record duplicate log if value did not actually change", async () => {
    const countBefore = await prisma.productAuditLog.count({
      where: { productId: testProduct.id },
    });

    await CatalogAuditService.recordChange({
      productId: testProduct.id,
      field: "SELLING_PRICE",
      oldValue: "149.90",
      newValue: "149.90", // Mesmo valor
    });

    const countAfter = await prisma.productAuditLog.count({
      where: { productId: testProduct.id },
    });

    expect(countAfter).toBe(countBefore);
  });

  it("3. should query global catalog audit history with pagination", async () => {
    const history = await CatalogAuditService.getGlobalAuditHistory({
      productId: testProduct.id,
      page: 1,
      limit: 10,
    });

    expect(history.total).toBeGreaterThanOrEqual(1);
    expect(history.logs.length).toBeGreaterThanOrEqual(1);
    expect(history.logs[0].product.sku).toBe(testProduct.sku);
  });
});

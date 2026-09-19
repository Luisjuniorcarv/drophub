import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { CatalogSyncService } from "@/modules/catalog/sync-service";
import { getTestSupplierAdapter } from "@/modules/suppliers/factory";

describe("ETAPA 14 — Catalog Supplier Synchronization & Error Protection Integration Tests", () => {
  const timestamp = Date.now();
  let testSupplier: any;
  let testProduct: any;
  let testSupplierProduct: any;

  beforeAll(async () => {
    testSupplier = await prisma.supplier.create({
      data: {
        name: `TEST_SUPPLIER_SYNC_${timestamp}`,
        contactName: "Contato Sync Test",
      },
    });

    testProduct = await prisma.product.create({
      data: {
        name: "Produto Sincronizavel",
        slug: `prod-sync-${timestamp}`,
        sku: `SKU-SYNC-${timestamp}`,
        description: "Desc",
        costPrice: new Decimal("50.00"),
        sellingPrice: new Decimal("120.00"),
        stock: 10,
        supplierId: testSupplier.id,
      },
    });

    testSupplierProduct = await prisma.supplierProduct.create({
      data: {
        productId: testProduct.id,
        supplierId: testSupplier.id,
        externalSku: "TEST-SKU-001",
        supplierCost: new Decimal("35.00"),
        supplierStock: 40,
        isAvailable: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.supplierProduct.deleteMany({ where: { supplierId: testSupplier.id } });
    await prisma.product.deleteMany({ where: { id: testProduct.id } });
    await prisma.supplier.deleteMany({ where: { id: testSupplier.id } });
  });

  it("1. should successfully sync supplier cost and stock using SupplierAdapter", async () => {
    const testAdapter = getTestSupplierAdapter();
    testAdapter.setShouldFail(false);
    testAdapter.setSimulateTimeout(false);

    const result = await CatalogSyncService.syncSupplierProduct(testSupplierProduct.id, {
      updateProductCommercialStock: true,
    });

    expect(result.success).toBe(true);
    expect(result.newCost).toBeGreaterThan(0);
    expect(result.newStock).toBeGreaterThan(0);

    // Verificar no banco
    const updatedSp = await prisma.supplierProduct.findUnique({
      where: { id: testSupplierProduct.id },
    });
    expect(updatedSp?.lastSyncedAt).not.toBeNull();
    expect(updatedSp?.lastSyncError).toBeNull();
    expect(Number(updatedSp?.supplierCost)).toBe(result.newCost);
  });

  it("2. should protect valid data against supplier failure: never zero out cost/stock and record error", async () => {
    const testAdapter = getTestSupplierAdapter();
    // Simula erro de timeout no fornecedor
    testAdapter.setSimulateTimeout(true);

    const beforeSp = await prisma.supplierProduct.findUnique({
      where: { id: testSupplierProduct.id },
    });
    const previousCost = Number(beforeSp?.supplierCost);
    const previousStock = beforeSp?.supplierStock;

    const result = await CatalogSyncService.syncSupplierProduct(testSupplierProduct.id);

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();

    // Dados no banco não foram destruídos/zerados
    const afterSp = await prisma.supplierProduct.findUnique({
      where: { id: testSupplierProduct.id },
    });

    expect(Number(afterSp?.supplierCost)).toBe(previousCost);
    expect(afterSp?.supplierStock).toBe(previousStock);
    expect(afterSp?.lastSyncError).toContain("TIMEOUT");

    // Produto continua existindo
    const product = await prisma.product.findUnique({ where: { id: testProduct.id } });
    expect(product).toBeDefined();

    // Restaura estado do adapter
    testAdapter.setSimulateTimeout(false);
  });
});

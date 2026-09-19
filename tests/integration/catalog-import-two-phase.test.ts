import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { CatalogImportService } from "@/modules/catalog/import-service";

describe("ETAPA 14 — Catalog Import Two-Phase (Preview & Commit) Integration Tests", () => {
  const timestamp = Date.now();
  const sku1 = `IMP-SKU1-${timestamp}`;
  const sku2 = `IMP-SKU2-${timestamp}`;
  const duplicateSku = `IMP-DUP-${timestamp}`;

  afterAll(async () => {
    await prisma.supplierProduct.deleteMany({
      where: { externalSku: { in: [sku1, sku2, duplicateSku] } },
    });
    await prisma.product.deleteMany({
      where: { sku: { in: [sku1, sku2, duplicateSku] } },
    });
  });

  it("1. should generate comprehensive preview detecting valid, invalid and duplicate records in CSV", async () => {
    const csvContent = `sku,name,description,costPrice,sellingPrice,stock,category,supplier\n${sku1},Item Importado 1,Descricao 1,25.00,79.90,100,Eletronicos Teste,Fornecedor Alpha\n${sku2},Item Importado 2,Descricao 2,40.00,119.90,50,Eletronicos Teste,Fornecedor Beta\n${duplicateSku},Item Duplicado Linha 1,Descricao 3,10.00,30.00,10,Geral,Fornecedor Gamma\n${duplicateSku},Item Duplicado Linha 2,Descricao 4,10.00,30.00,10,Geral,Fornecedor Gamma\nINVALID-SKU,Item Sem Preco Valido,Descricao 5,10.00,-5.00,10,Geral,Fornecedor Gamma`;

    const preview = await CatalogImportService.preview({
      format: "CSV",
      rawData: csvContent,
      defaultStatus: "ACTIVE" as any,
    });

    expect(preview.totalRows).toBe(5);
    expect(preview.validCount).toBe(3); // sku1, sku2, first occurrence of duplicateSku
    expect(preview.invalidCount).toBe(1); // negative price item
    expect(preview.duplicateInFileCount).toBe(1); // second occurrence of duplicateSku
    expect(preview.summary.canCommit).toBe(true);

    const dupRow = preview.rows.find((r) => r.isDuplicateInFile);
    expect(dupRow).toBeDefined();
    expect(dupRow?.action).toBe("SKIP");

    const invalidRow = preview.rows.find((r) => r.action === "INVALID");
    expect(invalidRow).toBeDefined();
    expect(invalidRow?.errors[0]).toContain("sellingPrice");
  });

  it("2. should commit valid import items transactionally and create Product and SupplierProduct", async () => {
    const validItems = [
      {
        sku: sku1,
        name: "Item Importado 1",
        description: "Descricao do Item 1",
        costPrice: 25.0,
        sellingPrice: 79.9,
        stock: 100,
        categoryName: `Cat_Imp_${timestamp}`,
        supplierName: `Sup_Imp_${timestamp}`,
        status: "ACTIVE",
      },
      {
        sku: sku2,
        name: "Item Importado 2",
        description: "Descricao do Item 2",
        costPrice: 40.0,
        sellingPrice: 119.9,
        stock: 50,
        categoryName: `Cat_Imp_${timestamp}`,
        supplierName: `Sup_Imp_${timestamp}`,
        status: "ACTIVE",
      },
    ];

    const batchId = `test_batch_${timestamp}`;

    const commitResult = await CatalogImportService.commit({
      importBatchId: batchId,
      items: validItems,
      updateExisting: true,
      syncStockLedger: true,
    });

    expect(commitResult.success).toBe(true);
    expect(commitResult.createdCount).toBe(2);
    expect(commitResult.failedCount).toBe(0);

    // Verificar se produtos foram criados no banco
    const dbProduct1 = await prisma.product.findUnique({
      where: { sku: sku1 },
      include: { category: true, supplier: true, supplierProducts: true },
    });
    expect(dbProduct1).toBeDefined();
    expect(dbProduct1?.name).toBe("Item Importado 1");
    expect(Number(dbProduct1?.sellingPrice)).toBe(79.9);
    expect(dbProduct1?.supplierProducts).toHaveLength(1);
    expect(Number(dbProduct1?.supplierProducts[0].supplierCost)).toBe(25.0);

    // Idempotência: reexecutar o mesmo commit deve atualizar sem gerar duplicações
    const repeatCommit = await CatalogImportService.commit({
      importBatchId: batchId,
      items: validItems,
      updateExisting: true,
      syncStockLedger: true,
    });

    expect(repeatCommit.success).toBe(true);
    expect(repeatCommit.updatedCount).toBe(2);
    expect(repeatCommit.createdCount).toBe(0);
  });
});

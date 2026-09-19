import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { calculatePricingMetrics } from "@/lib/finance-math";
import { getStorefrontProducts } from "@/modules/storefront/service";

describe("ETAPA 14 — Advanced Catalog, Status & Dropshipping Structure Integration Tests", () => {
  const timestamp = Date.now();
  let testSupplier: any;
  let testCategory: any;

  beforeAll(async () => {
    testSupplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor Stage14_${timestamp}`,
        contactName: "Contato Stage 14",
        email: `stage14_${timestamp}@fornecedor.com`,
      },
    });

    testCategory = await prisma.category.create({
      data: {
        name: `Categoria Stage14_${timestamp}`,
        slug: `cat-stage14-${timestamp}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.supplierProduct.deleteMany({ where: { supplierId: testSupplier.id } });
    await prisma.product.deleteMany({ where: { categoryId: testCategory.id } });
    await prisma.category.deleteMany({ where: { id: testCategory.id } });
    await prisma.supplier.deleteMany({ where: { id: testSupplier.id } });
  });

  it("1. should support complete commercial status lifecycle (DRAFT, ACTIVE, INACTIVE, ARCHIVED)", async () => {
    const sku = `SKU-CYCLE-${timestamp}`;

    // 1. Criar como DRAFT
    const draftProduct = await prisma.product.create({
      data: {
        name: "Produto Ciclo de Vida",
        slug: `slug-ciclo-${timestamp}`,
        sku,
        description: "Descrição de teste do ciclo de vida",
        costPrice: new Decimal("40.00"),
        sellingPrice: new Decimal("100.00"),
        stock: 50,
        status: ProductStatus.DRAFT,
        categoryId: testCategory.id,
      },
    });
    expect(draftProduct.status).toBe(ProductStatus.DRAFT);

    // 2. Atualizar para ACTIVE
    const activeProduct = await prisma.product.update({
      where: { id: draftProduct.id },
      data: { status: ProductStatus.ACTIVE },
    });
    expect(activeProduct.status).toBe(ProductStatus.ACTIVE);

    // 3. Atualizar para INACTIVE
    const inactiveProduct = await prisma.product.update({
      where: { id: draftProduct.id },
      data: { status: ProductStatus.INACTIVE },
    });
    expect(inactiveProduct.status).toBe(ProductStatus.INACTIVE);

    // 4. Atualizar para ARCHIVED
    const archivedProduct = await prisma.product.update({
      where: { id: draftProduct.id },
      data: { status: ProductStatus.ARCHIVED },
    });
    expect(archivedProduct.status).toBe(ProductStatus.ARCHIVED);
  });

  it("2. should strictly isolate storefront: only ACTIVE products appear in public search", async () => {
    // Cria 1 ACTIVE e 1 INACTIVE na mesma categoria
    const activeProd = await prisma.product.create({
      data: {
        name: `Prod Ativo ${timestamp}`,
        slug: `prod-ativo-${timestamp}`,
        sku: `SKU-ACT-${timestamp}`,
        description: "Desc",
        costPrice: new Decimal("20.00"),
        sellingPrice: new Decimal("50.00"),
        stock: 10,
        status: ProductStatus.ACTIVE,
        active: true,
        categoryId: testCategory.id,
      },
    });

    const inactiveProd = await prisma.product.create({
      data: {
        name: `Prod Inativo ${timestamp}`,
        slug: `prod-inativo-${timestamp}`,
        sku: `SKU-INACT-${timestamp}`,
        description: "Desc",
        costPrice: new Decimal("20.00"),
        sellingPrice: new Decimal("50.00"),
        stock: 10,
        status: ProductStatus.INACTIVE,
        active: false,
        categoryId: testCategory.id,
      },
    });

    const storefrontCatalog = await getStorefrontProducts({
      categorySlug: testCategory.slug,
    });

    const returnedIds = storefrontCatalog.products.map((p) => p.id);
    expect(returnedIds).toContain(activeProd.id);
    expect(returnedIds).not.toContain(inactiveProd.id);
  });

  it("3. should link SupplierProduct with external SKU and isolate supplier cost from order snapshots", async () => {
    const product = await prisma.product.create({
      data: {
        name: "Produto Dropshipping Multi-fornecedor",
        slug: `prod-drop-${timestamp}`,
        sku: `SKU-DROP-${timestamp}`,
        description: "Desc",
        costPrice: new Decimal("40.00"), // Custo contábil adotado no DropHub
        sellingPrice: new Decimal("120.00"),
        stock: 25,
        status: ProductStatus.ACTIVE,
        supplierId: testSupplier.id,
        categoryId: testCategory.id,
      },
    });

    // Vincula cotação do fornecedor via SupplierProduct
    const supplierProduct = await prisma.supplierProduct.create({
      data: {
        productId: product.id,
        supplierId: testSupplier.id,
        externalProductId: "EXT-PROD-9988",
        externalSku: "EXT-SKU-9988",
        supplierCost: new Decimal("38.50"), // Custo cotado pelo fornecedor
        supplierStock: 250, // Estoque no armazém do fornecedor
        isAvailable: true,
        lastSyncedAt: new Date(),
      },
    });

    expect(supplierProduct.externalSku).toBe("EXT-SKU-9988");
    expect(Number(supplierProduct.supplierCost)).toBe(38.5);
    expect(supplierProduct.supplierStock).toBe(250);

    // Custo comercial do DropHub continua isolado (R$ 40.00)
    const metrics = calculatePricingMetrics(Number(product.costPrice), Number(product.sellingPrice));
    expect(metrics.profit).toBe(80);
    expect(metrics.marginPercentage).toBe(66.67);
  });
});

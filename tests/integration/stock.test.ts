import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import {
  decrementStockAtomic,
  incrementStockAtomic,
  restockProduct,
  adjustStock,
  reconcileStock,
  listStockMovements,
  getStockSummary,
} from "../../src/modules/stock";
import { ProductStatus } from "@prisma/client";

describe("Stock Module Integration Tests", () => {
  let testProductId: string;
  let testProductWithVariantsId: string;
  let testVariantId: string;
  const uniquePrefix = `test_stock_${Date.now()}`;

  beforeAll(async () => {
    // 1. Cria produto simples para testes de estoque
    const simpleProduct = await prisma.product.create({
      data: {
        name: `${uniquePrefix}_Produto_Simples`,
        slug: `${uniquePrefix}-produto-simples`,
        sku: `${uniquePrefix}-SKU-SIMPLES`,
        description: "Produto para testes de estoque integrado",
        costPrice: 20.0,
        sellingPrice: 50.0,
        stock: 20,
        status: ProductStatus.ACTIVE,
      },
    });
    testProductId = simpleProduct.id;

    // 2. Cria produto com variações
    const productWithVariants = await prisma.product.create({
      data: {
        name: `${uniquePrefix}_Produto_Com_Variacao`,
        slug: `${uniquePrefix}-produto-com-variacao`,
        sku: `${uniquePrefix}-SKU-PAI`,
        description: "Produto pai com variacao",
        costPrice: 30.0,
        sellingPrice: 80.0,
        stock: 15,
        status: ProductStatus.ACTIVE,
        variants: {
          create: {
            name: "Azul / G",
            sku: `${uniquePrefix}-VAR-AZUL-G`,
            attributesJson: { cor: "Azul", tamanho: "G" },
            costPrice: 30.0,
            sellingPrice: 80.0,
            stock: 15,
          },
        },
      },
      include: { variants: true },
    });
    testProductWithVariantsId = productWithVariants.id;
    testVariantId = productWithVariants.variants[0].id;
  });

  afterAll(async () => {
    // Limpeza
    await prisma.stockMovement.deleteMany({
      where: { productId: { in: [testProductId, testProductWithVariantsId] } },
    });
    await prisma.productVariant.deleteMany({
      where: { productId: testProductWithVariantsId },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [testProductId, testProductWithVariantsId] } },
    });
  });

  describe("decrementStockAtomic", () => {
    it("should atomically decrement stock and record StockMovement with SALE type", async () => {
      const orderId = `test_order_${Date.now()}`;
      await decrementStockAtomic(prisma, {
        items: [
          {
            productId: testProductId,
            quantity: 3,
            unitPrice: 50.0,
            name: "Produto Simples",
          },
        ],
        orderId,
        type: "SALE",
        reason: "Venda de teste unitário",
      });

      const updated = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(updated?.stock).toBe(17); // 20 - 3 = 17

      const movement = await prisma.stockMovement.findFirst({
        where: { productId: testProductId, idempotencyKey: { contains: orderId } },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(-3);
      expect(movement?.balanceBefore).toBe(20);
      expect(movement?.balanceAfter).toBe(17);
      expect(movement?.type).toBe("SALE");
    });

    it("should atomically decrement stock for variant and parent product", async () => {
      const orderId = `test_order_var_${Date.now()}`;
      await decrementStockAtomic(prisma, {
        items: [
          {
            productId: testProductWithVariantsId,
            variantId: testVariantId,
            quantity: 5,
            unitPrice: 80.0,
            name: "Produto Variação",
          },
        ],
        orderId,
        type: "SALE",
      });

      const updatedVariant = await prisma.productVariant.findUnique({ where: { id: testVariantId } });
      const updatedParent = await prisma.product.findUnique({ where: { id: testProductWithVariantsId } });

      expect(updatedVariant?.stock).toBe(10); // 15 - 5 = 10
      expect(updatedParent?.stock).toBe(10); // 15 - 5 = 10

      const movement = await prisma.stockMovement.findFirst({
        where: { variantId: testVariantId, idempotencyKey: { contains: orderId } },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(-5);
      expect(movement?.balanceBefore).toBe(15);
      expect(movement?.balanceAfter).toBe(10);
    });

    it("should throw error and rollback if requested quantity exceeds current stock", async () => {
      const orderId = `test_order_fail_${Date.now()}`;
      await expect(
        decrementStockAtomic(prisma, {
          items: [
            {
              productId: testProductId,
              quantity: 999, // Exceeds available (17)
            },
          ],
          orderId,
        })
      ).rejects.toThrow(/INSUFFICIENT_STOCK/);

      // Verify stock remained unchanged
      const product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(17);
    });

    it("should be idempotent and not decrement twice if called with same orderId and item", async () => {
      const orderId = `test_order_idem_${Date.now()}`;
      const itemParams = {
        productId: testProductId,
        quantity: 2,
        orderItemId: "item-123",
      };

      // 1st call
      await decrementStockAtomic(prisma, {
        items: [itemParams],
        orderId,
      });

      let product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(15); // 17 - 2 = 15

      // 2nd identical call (idempotent retry)
      await decrementStockAtomic(prisma, {
        items: [itemParams],
        orderId,
      });

      product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(15); // Remains 15! Not 13!
    });
  });

  describe("incrementStockAtomic (Cancellation & Return)", () => {
    it("should increment stock and record CANCEL movement", async () => {
      const orderId = `test_cancel_${Date.now()}`;
      await incrementStockAtomic(prisma, {
        items: [
          {
            productId: testProductId,
            quantity: 2,
            orderItemId: "item-cancel-1",
          },
        ],
        orderId,
        type: "CANCEL",
        reason: "Cancelamento de teste",
      });

      const product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(17); // 15 + 2 = 17

      const movement = await prisma.stockMovement.findFirst({
        where: { productId: testProductId, type: "CANCEL", idempotencyKey: { contains: orderId } },
      });
      expect(movement).toBeDefined();
      expect(movement?.quantity).toBe(2);
      expect(movement?.balanceBefore).toBe(15);
      expect(movement?.balanceAfter).toBe(17);
    });

    it("should prevent double return if cancellation is called twice with same orderId and item", async () => {
      const orderId = `test_double_cancel_${Date.now()}`;
      const item = {
        productId: testProductId,
        quantity: 3,
        orderItemId: "item-double-cancel",
      };

      // 1st cancellation call
      await incrementStockAtomic(prisma, {
        items: [item],
        orderId,
        type: "CANCEL",
      });

      let product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(20); // 17 + 3 = 20

      // 2nd cancellation call (duplicate request)
      await incrementStockAtomic(prisma, {
        items: [item],
        orderId,
        type: "CANCEL",
      });

      product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(20); // Still 20, no double return!
    });
  });

  describe("restockProduct", () => {
    it("should increase stock and record RESTOCK movement with metadata", async () => {
      const result = await restockProduct({
        productId: testProductId,
        quantity: 10,
        unitCost: 18.5,
        reason: "Reposição lote #99",
      });

      expect(result.newBalance).toBe(30); // 20 + 10 = 30
      expect(result.movement.type).toBe("RESTOCK");
      expect(result.movement.quantity).toBe(10);
      expect(result.movement.balanceBefore).toBe(20);
      expect(result.movement.balanceAfter).toBe(30);

      const product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(30);
    });
  });

  describe("adjustStock", () => {
    it("should set stock to exact new balance and record adjustment diff", async () => {
      const result = await adjustStock({
        productId: testProductId,
        newBalance: 25,
        reason: "Ajuste de inventário físico",
        type: "ADJUSTMENT",
      });

      expect(result.newBalance).toBe(25);
      expect(result.diff).toBe(-5); // 25 - 30 = -5
      expect(result.movement.type).toBe("ADJUSTMENT");
      expect(result.movement.quantity).toBe(-5);
      expect(result.movement.balanceBefore).toBe(30);
      expect(result.movement.balanceAfter).toBe(25);

      const product = await prisma.product.findUnique({ where: { id: testProductId } });
      expect(product?.stock).toBe(25);
    });
  });

  describe("reconcileStock and getStockSummary", () => {
    it("should perform mathematical consistency check against stock movements", async () => {
      const recon = await reconcileStock(testProductId);
      expect(recon.productId).toBe(testProductId);
      expect(recon.currentBalance).toBe(25);
      expect(recon.isConsistent).toBe(true);
      expect(recon.difference).toBe(0);
      expect(recon.totalMovementsCount).toBeGreaterThan(0);
    });

    it("should return executive stock summary report", async () => {
      const summary = await getStockSummary();
      expect(summary.totalSkus).toBeGreaterThan(0);
      expect(summary.totalUnitsInStock).toBeGreaterThan(0);
      expect(summary.items).toBeInstanceOf(Array);
    });
  });
});

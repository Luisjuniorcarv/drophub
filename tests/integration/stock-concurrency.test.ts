import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { decrementStockAtomic, incrementStockAtomic } from "../../src/modules/stock";
import { createStorefrontOrder } from "../../src/modules/storefront/service";
import { ProductStatus, PaymentMethod } from "@prisma/client";

interface ConcurrencyResult {
  success: boolean;
  buyerNum?: number;
  callNum?: number;
  orderId?: string;
  error?: string;
}

describe("Stock Real Concurrency & Anti-Overselling Tests", () => {
  const uniquePrefix = `conc_test_${Date.now()}`;
  let singleStockProductId: string;
  let fiveStockProductId: string;
  let storefrontStockProductId: string;

  beforeAll(async () => {
    // 1. Produto com estoque = 1 (para teste de 2 compradores simultâneos)
    const p1 = await prisma.product.create({
      data: {
        name: `${uniquePrefix}_Item_Unico`,
        slug: `${uniquePrefix}-item-unico`,
        sku: `${uniquePrefix}-SKU-1`,
        description: "Produto com apenas 1 unidade para teste de corrida",
        costPrice: 10.0,
        sellingPrice: 30.0,
        stock: 1,
        status: ProductStatus.ACTIVE,
      },
    });
    singleStockProductId = p1.id;

    // 2. Produto com estoque = 5 (para teste de 10 compradores simultâneos)
    const p5 = await prisma.product.create({
      data: {
        name: `${uniquePrefix}_Item_Cinco`,
        slug: `${uniquePrefix}-item-cinco`,
        sku: `${uniquePrefix}-SKU-5`,
        description: "Produto com 5 unidades para teste de 10 requisições simultâneas",
        costPrice: 15.0,
        sellingPrice: 40.0,
        stock: 5,
        status: ProductStatus.ACTIVE,
      },
    });
    fiveStockProductId = p5.id;

    // 3. Produto para teste de Checkout da Loja Pública com concorrência real
    const pStore = await prisma.product.create({
      data: {
        name: `${uniquePrefix}_Item_Storefront`,
        slug: `${uniquePrefix}-item-storefront`,
        sku: `${uniquePrefix}-SKU-STORE`,
        description: "Produto para checkout simultâneo na loja pública",
        costPrice: 25.0,
        sellingPrice: 60.0,
        stock: 2,
        status: ProductStatus.ACTIVE,
      },
    });
    storefrontStockProductId = pStore.id;
  });

  afterAll(async () => {
    // Limpeza completa
    const productIds = [singleStockProductId, fiveStockProductId, storefrontStockProductId];
    await prisma.stockMovement.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.orderItem.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({
      where: { id: { in: productIds } },
    });
  });

  it("Scenario 1: 2 concurrent buyers on stock = 1 -> Exactly 1 succeeds, 1 fails, final stock = 0", async () => {
    // Dispara 2 decrementos atômicos simultaneamente via Promise.all
    const promises: Promise<ConcurrencyResult>[] = [1, 2].map((buyerNum) =>
      decrementStockAtomic(prisma, {
        items: [{ productId: singleStockProductId, quantity: 1 }],
        orderId: `order_c1_buyer_${buyerNum}_${Date.now()}`,
        type: "SALE",
        reason: `Comprador concorrente #${buyerNum}`,
      })
        .then((): ConcurrencyResult => ({ success: true, buyerNum }))
        .catch((err): ConcurrencyResult => ({ success: false, buyerNum, error: err.message }))
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(successful.length).toBe(1);
    expect(failed.length).toBe(1);
    expect(failed[0].error).toMatch(/INSUFFICIENT_STOCK/);

    // Saldo no banco deve ser exatamente 0 (NUNCA -1)
    const product = await prisma.product.findUnique({ where: { id: singleStockProductId } });
    expect(product?.stock).toBe(0);

    // Deve haver exatamente 1 StockMovement gravado
    const movements = await prisma.stockMovement.findMany({
      where: { productId: singleStockProductId, type: "SALE" },
    });
    expect(movements.length).toBe(1);
    expect(movements[0].balanceBefore).toBe(1);
    expect(movements[0].balanceAfter).toBe(0);
  });

  it("Scenario 2: 10 concurrent buyers on stock = 5 -> Exactly 5 succeed, 5 fail, final stock = 0", async () => {
    // Dispara 10 decrementos simultâneos via Promise.all
    const promises: Promise<ConcurrencyResult>[] = Array.from({ length: 10 }, (_, i) => i + 1).map((buyerNum) =>
      decrementStockAtomic(prisma, {
        items: [{ productId: fiveStockProductId, quantity: 1 }],
        orderId: `order_c5_buyer_${buyerNum}_${Date.now()}`,
        type: "SALE",
        reason: `Comprador concorrente #${buyerNum}`,
      })
        .then((): ConcurrencyResult => ({ success: true, buyerNum }))
        .catch((err): ConcurrencyResult => ({ success: false, buyerNum, error: err.message }))
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(successful.length).toBe(5);
    expect(failed.length).toBe(5);
    for (const f of failed) {
      expect(f.error).toMatch(/INSUFFICIENT_STOCK/);
    }

    // Saldo no banco deve ser exatamente 0 (NUNCA negativo)
    const product = await prisma.product.findUnique({ where: { id: fiveStockProductId } });
    expect(product?.stock).toBe(0);

    // Devem existir exatamente 5 movimentos de venda registrados
    const movements = await prisma.stockMovement.findMany({
      where: { productId: fiveStockProductId, type: "SALE" },
    });
    expect(movements.length).toBe(5);
  });

  it("Scenario 3: 5 concurrent Storefront Checkout orders on stock = 2 -> Exactly 2 orders created, 3 rejected", async () => {
    const promises: Promise<ConcurrencyResult>[] = Array.from({ length: 5 }, (_, i) => i + 1).map((buyerNum) =>
      createStorefrontOrder({
        customer: {
          name: `Cliente Concorrente ${buyerNum}`,
          email: `concorrente_${buyerNum}_${Date.now()}@teste.com`,
          cpf: `000.000.00${buyerNum}-00`,
          phone: "11988887777",
        },
        shippingAddress: {
          street: "Av Paulista",
          number: `${100 + buyerNum}`,
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310-100",
        },
        items: [
          {
            productId: storefrontStockProductId,
            quantity: 1,
          },
        ],
        paymentMethod: PaymentMethod.PIX,
      })
        .then((order): ConcurrencyResult => ({ success: true, buyerNum, orderId: order.id }))
        .catch((err): ConcurrencyResult => ({ success: false, buyerNum, error: err.message }))
    );

    const results = await Promise.all(promises);

    const successful = results.filter((r) => r.success);
    const failed = results.filter((r) => !r.success);

    expect(successful.length).toBe(2);
    expect(failed.length).toBe(3);

    // Saldo final deve ser 0
    const product = await prisma.product.findUnique({ where: { id: storefrontStockProductId } });
    expect(product?.stock).toBe(0);

    // Devem existir exatamente 2 pedidos com esse produto
    const orderItems = await prisma.orderItem.findMany({
      where: { productId: storefrontStockProductId },
    });
    expect(orderItems.length).toBe(2);
  });

  it("Scenario 4: 5 concurrent cancellation returns for the same order -> Stock incremented exactly once (idempotent)", async () => {
    const sharedOrderId = `order_shared_cancel_${Date.now()}`;
    const sharedItemId = `item_shared_${Date.now()}`;

    // Dispara 5 chamadas de cancelamento simultâneas para o mesmo pedido/item
    const promises: Promise<ConcurrencyResult>[] = Array.from({ length: 5 }, (_, i) => i + 1).map((callNum) =>
      incrementStockAtomic(prisma, {
        items: [
          {
            productId: storefrontStockProductId,
            quantity: 2,
            orderItemId: sharedItemId,
          },
        ],
        orderId: sharedOrderId,
        type: "CANCEL",
        reason: "Cancelamento concorrente",
      })
        .then((): ConcurrencyResult => ({ success: true, callNum }))
        .catch((err): ConcurrencyResult => ({ success: false, callNum, error: err.message }))
    );

    const results = await Promise.all(promises);
    expect(results.every((r) => r.success)).toBe(true);

    // Saldo era 0, após incremento idempotente de 2, deve ser 2 (NÃO 10!)
    const product = await prisma.product.findUnique({ where: { id: storefrontStockProductId } });
    expect(product?.stock).toBe(2);

    // Apenas 1 movimento de cancelamento gravado
    const movements = await prisma.stockMovement.findMany({
      where: { idempotencyKey: { contains: sharedOrderId }, type: "CANCEL" },
    });
    expect(movements.length).toBe(1);
  });
});

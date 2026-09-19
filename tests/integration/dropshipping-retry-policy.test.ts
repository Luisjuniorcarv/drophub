import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
} from "@/modules/fulfillment/service";
import { OrderStatus, FulfillmentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping Retry Policy & Failure Threshold Tests", () => {
  let customer: any;
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Retry Policy",
        email: `retry_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11988887777",
      },
    });

    supplier = await prisma.supplier.create({
      data: { name: `Fornecedor Retry ${Date.now()}` },
    });

    product = await prisma.product.create({
      data: {
        name: "Item com Erro de Rede",
        slug: `item-retry-${Date.now()}`,
        sku: `SKU-RETRY-${Date.now()}`,
        description: "Teste de threshold",
        costPrice: new Decimal(30.0),
        sellingPrice: new Decimal(80.0),
        stock: 50,
        supplierId: supplier.id,
      },
    });
  });

  it("should execute 3 attempts max with progressive backoff and transition to FAILED on 3rd failure", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-POL-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(80.0),
        totalAmount: new Decimal(80.0),
        totalCostAmount: new Decimal(30.0),
        estimatedProfit: new Decimal(50.0),
        marginPercentage: new Decimal(62.5),
        markupPercentage: new Decimal(166.7),
        shippingAddress: {},
        items: {
          create: [
            {
              productId: product.id,
              sku: product.sku,
              name: product.name,
              unitCost: product.costPrice,
              unitPrice: product.sellingPrice,
              quantity: 1,
              totalCost: product.costPrice,
              totalPrice: product.sellingPrice,
              profit: new Decimal(50.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // === TENTATIVA 1 (Initial attempt) ===
    const attempt1 = await submitFulfillmentOrder(fulfillmentId, {
      simulatedFailure: true,
      failureMessage: "502 Bad Gateway - Fornecedor indisponível",
    });

    expect(attempt1.success).toBe(false);
    expect(attempt1.fulfillment.attempts).toBe(1);
    expect(attempt1.fulfillment.status).toBe(FulfillmentStatus.PENDING);
    expect(attempt1.fulfillment.nextAttemptAt).toBeDefined();

    // Validar intervalo de ~1 minuto para a tentativa 1
    const delay1Ms = new Date(attempt1.fulfillment.nextAttemptAt!).getTime() - Date.now();
    expect(delay1Ms).toBeGreaterThan(50 * 1000); // ~60s
    expect(delay1Ms).toBeLessThanOrEqual(65 * 1000);

    // === TENTATIVA 2 (1º Retry) ===
    const attempt2 = await submitFulfillmentOrder(fulfillmentId, {
      force: true,
      simulatedFailure: true,
      failureMessage: "504 Gateway Timeout",
    });

    expect(attempt2.success).toBe(false);
    expect(attempt2.fulfillment.attempts).toBe(2);
    expect(attempt2.fulfillment.status).toBe(FulfillmentStatus.PENDING);
    expect(attempt2.fulfillment.nextAttemptAt).toBeDefined();

    // Validar intervalo de ~5 minutos para a tentativa 2
    const delay2Ms = new Date(attempt2.fulfillment.nextAttemptAt!).getTime() - Date.now();
    expect(delay2Ms).toBeGreaterThan(4 * 60 * 1000); // ~300s
    expect(delay2Ms).toBeLessThanOrEqual(5.5 * 60 * 1000);

    // === TENTATIVA 3 (2º Retry / Final attempt reaching maxAttempts = 3) ===
    const attempt3 = await submitFulfillmentOrder(fulfillmentId, {
      force: true,
      simulatedFailure: true,
      failureMessage: "Fornecedor rejeitou pedido definitivamente",
    });

    expect(attempt3.success).toBe(false);
    expect(attempt3.fulfillment.attempts).toBe(3);
    expect(attempt3.fulfillment.status).toBe(FulfillmentStatus.FAILED);
    expect(attempt3.fulfillment.nextAttemptAt).toBeNull(); // Nenhuma nova tentativa automática
  });
});

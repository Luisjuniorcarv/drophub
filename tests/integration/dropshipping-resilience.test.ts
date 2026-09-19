import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  switchFulfillmentSupplier,
} from "@/modules/fulfillment/service";
import { processFulfillmentJobs } from "@/modules/fulfillment/worker";
import { OrderStatus, FulfillmentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping Resilience & Retry Worker Tests", () => {
  let customer: any;
  let supplier: any;
  let backupSupplier: any;
  let product: any;

  beforeEach(async () => {
    await prisma.fulfillmentHistory.deleteMany({});
    await prisma.fulfillmentItem.deleteMany({});
    await prisma.shipment.deleteMany({});
    await prisma.fulfillmentOrder.deleteMany({});

    customer = await prisma.customer.create({
      data: {
        name: "Cliente Resiliencia",
        email: `resil_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11966665555",
      },
    });

    supplier = await prisma.supplier.create({
      data: { name: `Fornecedor Instavel ${Date.now()}` },
    });

    backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Backup ${Date.now()}` },
    });

    product = await prisma.product.create({
      data: {
        name: "Produto Resiliente",
        slug: `prod-resil-${Date.now()}`,
        sku: `SKU-RESIL-${Date.now()}`,
        description: "Desc",
        costPrice: new Decimal(20.0),
        sellingPrice: new Decimal(50.0),
        stock: 50,
        supplierId: supplier.id,
      },
    });
  });

  it("1. should schedule retry with backoff on transient supplier error and succeed on worker retry", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-RESIL-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(50.0),
        totalAmount: new Decimal(50.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(30.0),
        marginPercentage: new Decimal(60.0),
        markupPercentage: new Decimal(150.0),
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
              profit: new Decimal(30.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // 1. Primeira submissão com falha simulada (timeout/500)
    const failRes = await submitFulfillmentOrder(fulfillmentId, {
      simulatedFailure: true,
      failureMessage: "504 Gateway Timeout na API do Fornecedor",
    });

    expect(failRes.success).toBe(false);
    expect(failRes.fulfillment.status).toBe(FulfillmentStatus.PENDING);
    expect(failRes.fulfillment.attempts).toBe(1);
    expect(failRes.fulfillment.nextAttemptAt).toBeDefined();

    // 2. Simular avanço do relógio ajustando nextAttemptAt para o passado
    await prisma.fulfillmentOrder.update({
      where: { id: fulfillmentId },
      data: { nextAttemptAt: new Date(Date.now() - 60000) },
    });

    // 3. Executar o worker de processamento
    const workerResult = await processFulfillmentJobs({ batchSize: 10 });
    expect(workerResult.retried).toBeGreaterThan(0);

    const fulfillmentAfterWorker = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulfillmentId },
    });

    expect(fulfillmentAfterWorker?.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(fulfillmentAfterWorker?.externalOrderId).toBeDefined();
  });

  it("2. should transition to FAILED when maxAttempts is reached without infinite retry loop", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-MAXFAIL-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(50.0),
        totalAmount: new Decimal(50.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(30.0),
        marginPercentage: new Decimal(60.0),
        markupPercentage: new Decimal(150.0),
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
              profit: new Decimal(30.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // Configurar attempts = 2 (para que a próxima tentativa seja a 3ª e atinja maxAttempts)
    await prisma.fulfillmentOrder.update({
      where: { id: fulfillmentId },
      data: { attempts: 2 },
    });

    const failRes = await submitFulfillmentOrder(fulfillmentId, {
      simulatedFailure: true,
      failureMessage: "SKU permanently rejected by supplier",
    });

    expect(failRes.success).toBe(false);
    expect(failRes.fulfillment.status).toBe(FulfillmentStatus.FAILED);
    expect(failRes.fulfillment.attempts).toBe(3);
    expect(failRes.fulfillment.nextAttemptAt).toBeNull();
  });
});

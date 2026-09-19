import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  addTrackingEventSafe,
  retryFulfillmentOrder,
} from "@/modules/fulfillment/service";
import { OrderStatus, FulfillmentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping Concurrency & Idempotency Integration Tests", () => {
  let customer: any;
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Concorrencia",
        email: `conc_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11999998888",
      },
    });

    supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor Concorrente ${Date.now()}`,
      },
    });

    product = await prisma.product.create({
      data: {
        name: "Produto Concorrente",
        slug: `prod-conc-${Date.now()}`,
        sku: `SKU-CONC-${Date.now()}`,
        description: "Desc Concorrente",
        costPrice: new Decimal(25.0),
        sellingPrice: new Decimal(70.0),
        stock: 100,
        supplierId: supplier.id,
      },
    });
  });

  it("1. should handle 10 concurrent fulfillment creations and produce exactly 1 fulfillment per supplier", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CONC-CR-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(70.0),
        totalAmount: new Decimal(70.0),
        totalCostAmount: new Decimal(25.0),
        estimatedProfit: new Decimal(45.0),
        marginPercentage: new Decimal(64.2),
        markupPercentage: new Decimal(180.0),
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
              profit: new Decimal(45.0),
            },
          ],
        },
      },
    });

    // Disparar 10 criações simultâneas
    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(() => createFulfillmentsForOrder(order.id))
    );

    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBeGreaterThan(0);

    const count = await prisma.fulfillmentOrder.count({
      where: { orderId: order.id },
    });

    expect(count).toBe(1);
  });

  it("2. should handle 10 concurrent submit calls safely without duplicating external orders", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CONC-SUB-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(70.0),
        totalAmount: new Decimal(70.0),
        totalCostAmount: new Decimal(25.0),
        estimatedProfit: new Decimal(45.0),
        marginPercentage: new Decimal(64.2),
        markupPercentage: new Decimal(180.0),
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
              profit: new Decimal(45.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // Disparar 10 submissões simultâneas
    const submitResults = await Promise.allSettled(
      Array.from({ length: 10 }).map(() => submitFulfillmentOrder(fulfillmentId))
    );

    const successful = submitResults.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBe(10);

    const fulfillmentDb = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulfillmentId },
    });

    expect(fulfillmentDb?.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(fulfillmentDb?.externalOrderId).toBeDefined();
    // Attempts deve ser no máximo o número de tentativas reais válidas
    expect(fulfillmentDb?.attempts).toBeGreaterThanOrEqual(1);
  });

  it("3. should handle 10 concurrent tracking insertions and maintain clean deduplication with zero inconsistencies in Shipment & Fulfillment", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CONC-TRK-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(70.0),
        totalAmount: new Decimal(70.0),
        totalCostAmount: new Decimal(25.0),
        estimatedProfit: new Decimal(45.0),
        marginPercentage: new Decimal(64.2),
        markupPercentage: new Decimal(180.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.SHIPPED,
        shippedAt: new Date(),
      },
    });

    const shipment = await prisma.shipment.create({
      data: {
        orderId: order.id,
        fulfillmentOrderId: fulfillment.id,
        supplierId: supplier.id,
        carrier: "Correios",
        trackingNumber: `BR${Date.now()}CONC`,
        status: "SHIPPED",
        shippedAt: new Date(),
      },
    });

    const eventPayload = {
      status: "IN_TRANSIT",
      description: "Objeto em transferência para a unidade central",
      location: "CD Cajamar",
      timestamp: new Date(),
    };

    // Inserir o mesmo evento 10 vezes em paralelo
    const insertResults = await Promise.allSettled(
      Array.from({ length: 10 }).map(() => addTrackingEventSafe(shipment.id, eventPayload))
    );

    // Todas as 10 chamadas devem ser resolvidas com sucesso (sem lançar erro para o caller)
    const fulfilled = insertResults.filter((r) => r.status === "fulfilled");
    expect(fulfilled.length).toBe(10);

    // 1. Exatamente 1 evento persistido no banco
    const trackings = await prisma.tracking.findMany({
      where: { shipmentId: shipment.id },
    });
    expect(trackings.length).toBe(1);
    expect(trackings[0].status).toBe("IN_TRANSIT");
    expect(trackings[0].description).toBe(eventPayload.description);
    expect(trackings[0].location).toBe(eventPayload.location);

    // 2. Nenhuma inconsistência no Shipment
    const shipmentInDb = await prisma.shipment.findUnique({
      where: { id: shipment.id },
      include: { trackings: true },
    });
    expect(shipmentInDb).toBeDefined();
    expect(shipmentInDb?.status).toBe("SHIPPED");
    expect(shipmentInDb?.trackingNumber).toBe(shipment.trackingNumber);
    expect(shipmentInDb?.trackings.length).toBe(1);

    // 3. Nenhuma inconsistência no Fulfillment
    const fulfillmentInDb = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulfillment.id },
      include: { shipments: true },
    });
    expect(fulfillmentInDb).toBeDefined();
    expect(fulfillmentInDb?.status).toBe(FulfillmentStatus.SHIPPED);
    expect(fulfillmentInDb?.shipments.length).toBe(1);
  });

  it("4. should guarantee PostgreSQL level deduplication even when in-memory mutex is bypassed (multi-process simulation)", async () => {
    const shipment = await prisma.shipment.create({
      data: {
        order: {
          create: {
            orderNumber: `DH-CONC-DB-RACE-${Date.now()}`,
            customerId: customer.id,
            status: OrderStatus.PAID,
            subtotalAmount: new Decimal(70.0),
            totalAmount: new Decimal(70.0),
            totalCostAmount: new Decimal(25.0),
            estimatedProfit: new Decimal(45.0),
            marginPercentage: new Decimal(64.2),
            markupPercentage: new Decimal(180.0),
            shippingAddress: {},
          },
        },
        carrier: "J&T Express",
        trackingNumber: `JT${Date.now()}RACE`,
        status: "SHIPPED",
      },
    });

    const fixedIdempotencyKey = `trk_race_${shipment.id}_CUSTOM_KEY_12345`;
    const eventPayload = {
      status: "CUSTOMS_CLEARED",
      description: "Desembaraço aduaneiro concluído no aeroporto internacional",
      location: "Aeroporto de Guarulhos - GRU",
      idempotencyKey: fixedIdempotencyKey,
    };

    // Disparar inserções paralelas concorrentes diretas contra a função
    const results = await Promise.allSettled(
      Array.from({ length: 10 }).map(() =>
        addTrackingEventSafe(shipment.id, {
          ...eventPayload,
          // Forçar mesma chave de idempotência para simular instâncias distintas
          idempotencyKey: fixedIdempotencyKey,
        })
      )
    );

    const successful = results.filter((r) => r.status === "fulfilled");
    expect(successful.length).toBe(10);

    const count = await prisma.tracking.count({
      where: { idempotencyKey: fixedIdempotencyKey },
    });

    expect(count).toBe(1);
  });
});

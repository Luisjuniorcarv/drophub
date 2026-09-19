import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { createStorefrontOrder } from "@/modules/storefront/service";
import { createCheckoutPayment } from "@/modules/payments/service";
import { processOutboxEvents } from "@/modules/automations/dispatcher";
import { OrderStatus, FulfillmentStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Outbox Domain Event Trigger -> Automatic Fulfillment Pipeline", () => {
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    await prisma.webhookDelivery.deleteMany({});
    await prisma.outboxEvent.deleteMany({});

    supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor Outbox ${Date.now()}`,
        email: "outbox@fornecedor.com",
      },
    });

    product = await prisma.product.create({
      data: {
        name: "Microfone Condensador Pro",
        slug: `mic-pro-${Date.now()}`,
        sku: `SKU-MIC-${Date.now()}`,
        description: "Microfone profissional de alta sensibilidade",
        costPrice: new Decimal(120.0),
        sellingPrice: new Decimal(350.0),
        stock: 30,
        supplierId: supplier.id,
      },
    });
  });

  it("should automatically generate and submit fulfillment when Outbox processes ORDER_PAID event", async () => {
    // 1. Cliente faz pedido no Storefront
    const order = await createStorefrontOrder({
      customer: {
        name: "Beatriz Compradora",
        email: `beatriz_${Date.now()}@teste.com`,
        cpf: "98765432100",
        phone: "11977778888",
      },
      shippingAddress: {
        street: "Rua Vergueiro",
        number: "500",
        complement: "Conj 42",
        neighborhood: "Liberdade",
        city: "São Paulo",
        state: "SP",
        postalCode: "01504-000",
      },
      items: [
        {
          productId: product.id,
          quantity: 1,
        },
      ],
      paymentMethod: PaymentMethod.PIX,
    });

    expect(order.status).toBe(OrderStatus.AWAITING_PAYMENT);

    // 2. Pagamento aprovado no gateway
    const paymentResult = await createCheckoutPayment({
      orderId: order.id,
      method: PaymentMethod.TEST_MODE,
      idempotencyKey: `pay_outbox_${order.id}`,
    });

    expect(paymentResult.gatewayResult.status).toBe("APPROVED");

    // Verificar se o pedido está PAID e evento gravado na Outbox
    const orderPaid = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderPaid?.status).toBe(OrderStatus.PAID);

    const outboxEvent = await prisma.outboxEvent.findFirst({
      where: {
        entityId: order.id,
        eventType: "ORDER_PAID",
        status: "PENDING",
      },
    });
    expect(outboxEvent).toBeDefined();

    // 3. Executar o processador automático da Outbox (disparado periodicamente por cron ou worker)
    const outboxResult = await processOutboxEvents(10);
    expect(outboxResult.processed).toBeGreaterThan(0);

    // 4. Validar que o handler interno criou e submeteu automaticamente a FulfillmentOrder
    const orderAfterOutbox = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        fulfillmentOrders: {
          include: {
            items: true,
            supplier: true,
          },
        },
      },
    });

    // Pedido avançou para SENT_TO_SUPPLIER ou AWAITING_SUPPLIER
    expect(
      orderAfterOutbox?.status === OrderStatus.SENT_TO_SUPPLIER ||
      orderAfterOutbox?.status === OrderStatus.AWAITING_SUPPLIER
    ).toBe(true);

    // FulfillmentOrder gerada automaticamente sem chamada manual
    expect(orderAfterOutbox?.fulfillmentOrders.length).toBe(1);
    const fulfillment = orderAfterOutbox!.fulfillmentOrders[0];
    expect(fulfillment.supplierId).toBe(supplier.id);
    expect(fulfillment.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(fulfillment.externalOrderId).toBeDefined();
    expect(fulfillment.items.length).toBe(1);
    expect(Number(fulfillment.items[0].unitCostSnapshot)).toBe(120.0);
  });
});

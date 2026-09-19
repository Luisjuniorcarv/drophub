import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import {
  createCheckoutPayment,
  processPaymentWebhook,
  cancelOrderPayment,
  refundOrderPayment,
  getPaymentDetails,
} from "../../src/modules/payments/service";
import { DOMAIN_EVENTS } from "../../src/modules/automations/events";

describe("Payments & Checkout Integration Tests", () => {
  let testCustomerId: string;
  let testProductId: string;
  let testSupplierId: string;
  let testCategoryId: string;

  beforeAll(async () => {
    // 1. Criar fornecedor
    const supplier = await prisma.supplier.create({
      data: {
        name: "TEST_SUPPLIER_PAYMENTS",
      },
    });
    testSupplierId = supplier.id;

    // 2. Criar categoria
    const category = await prisma.category.create({
      data: {
        name: "TEST_CAT_PAYMENTS",
        slug: `test-cat-payments-${Date.now()}`,
      },
    });
    testCategoryId = category.id;

    // 3. Criar produto
    const product = await prisma.product.create({
      data: {
        name: "Produto Teste Pagamento",
        slug: `prod-teste-pagamento-${Date.now()}`,
        sku: `SKU-PMT-${Date.now()}`,
        description: "Descrição de produto teste para gateway de pagamento",
        costPrice: 50.0,
        sellingPrice: 120.0,
        stock: 100,
        supplierId: testSupplierId,
        categoryId: testCategoryId,
      },
    });
    testProductId = product.id;

    // 4. Criar cliente com endereço
    const customer = await prisma.customer.create({
      data: {
        name: "Comprador Teste Pagamentos",
        email: `buyer.pmt.${Date.now()}@example.com`,
        cpf: `888${Date.now().toString().slice(-8)}`,
        phone: "11988887777",
        addresses: {
          create: {
            street: "Rua do Comércio",
            number: "500",
            neighborhood: "Bela Vista",
            city: "São Paulo",
            state: "SP",
            postalCode: "01310100",
            isDefault: true,
          },
        },
      },
    });
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    await prisma.payment.deleteMany({
      where: { order: { customerId: testCustomerId } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { customerId: testCustomerId } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { customerId: testCustomerId } },
    });
    await prisma.order.deleteMany({
      where: { customerId: testCustomerId },
    });
    await prisma.customerAddress.deleteMany({
      where: { customerId: testCustomerId },
    });
    await prisma.customer.deleteMany({
      where: { id: testCustomerId },
    });
    await prisma.product.deleteMany({
      where: { id: testProductId },
    });
    await prisma.category.deleteMany({
      where: { id: testCategoryId },
    });
    await prisma.supplier.deleteMany({
      where: { id: testSupplierId },
    });
    await prisma.outboxEvent.deleteMany({
      where: { entityType: "Payment" },
    });
  });

  // Helper para criar um pedido rápido
  async function createTestOrder(totalAmount = 145.0, shipping = 25.0) {
    const orderNumber = `DH-TEST-PMT-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return prisma.order.create({
      data: {
        orderNumber,
        customerId: testCustomerId,
        status: "AWAITING_PAYMENT",
        subtotalAmount: 120.0,
        shippingCost: shipping,
        discountAmount: 0.0,
        totalAmount: totalAmount,
        totalCostAmount: 50.0,
        estimatedProfit: totalAmount - 50.0,
        marginPercentage: ((totalAmount - 50.0) / totalAmount) * 100,
        markupPercentage: ((totalAmount - 50.0) / 50.0) * 100,
        shippingAddress: {
          street: "Rua do Comércio",
          number: "500",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310100",
        },
        items: {
          create: {
            productId: testProductId,
            sku: "SKU-PMT-SNAP",
            name: "Produto Teste Pagamento",
            unitCost: 50.0,
            unitPrice: 120.0,
            quantity: 1,
            totalCost: 50.0,
            totalPrice: 120.0,
            profit: 70.0,
          },
        },
      },
    });
  }

  it("should generate a pending Pix payment with QR code and idempotency", async () => {
    const order = await createTestOrder(145.0, 25.0);

    // 1. Primeira geração de Pix
    const { payment: payment1 } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    expect(payment1.id).toBeDefined();
    expect(payment1.status).toBe("PENDING");
    expect(Number(payment1.amount)).toBe(145.0);
    expect(payment1.method).toBe("PIX");
    expect(payment1.qrCode).toBeDefined();
    expect(payment1.qrCodeBase64).toBeDefined();
    expect(payment1.idempotencyKey).toBeDefined();

    // 2. Segunda geração para o mesmo pedido deve ser idempotente (reutiliza o Pix pendente ativo)
    const { payment: payment2 } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    expect(payment2.id).toBe(payment1.id);
    expect(payment2.idempotencyKey).toBe(payment1.idempotencyKey);
  });

  it("should process webhook payment approval and update Order status atomically with Outbox events", async () => {
    const order = await createTestOrder(145.0, 25.0);

    // Gerar pagamento Pix
    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    // Simular Webhook de Aprovação
    const webhookResult = await processPaymentWebhook({
      gatewayName: "TEST",
      rawBody: JSON.stringify({
        event: "PAYMENT_APPROVED",
        transactionId: payment.transactionId!,
      }),
      headers: {},
    });

    expect(webhookResult.success).toBe(true);
    expect(webhookResult.status).toBe("APPROVED");

    // Verificar se o Pagamento foi atualizado no banco
    const updatedPayment = await prisma.payment.findUnique({
      where: { id: payment.id },
    });
    expect(updatedPayment?.status).toBe("APPROVED");
    expect(updatedPayment?.paidAt).toBeDefined();

    // Verificar se o Pedido foi atualizado para PAID
    const updatedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true },
    });
    expect(updatedOrder?.status).toBe("PAID");

    // Verificar histórico de auditoria
    const lastHistory = updatedOrder?.statusHistory[updatedOrder.statusHistory.length - 1];
    expect(lastHistory?.newStatus).toBe("PAID");
    expect(lastHistory?.reason).toContain("Pagamento aprovado");

    // Verificar Outbox Events
    const outboxEvents = await prisma.outboxEvent.findMany({
      where: {
        entityType: "Payment",
        entityId: payment.id,
      },
    });
    expect(outboxEvents.length).toBeGreaterThan(0);
    const approvedEvent = outboxEvents.find((e) => e.eventType === DOMAIN_EVENTS.PAYMENT_APPROVED);
    expect(approvedEvent).toBeDefined();
  });

  it("should be idempotent when receiving duplicate webhook approval notifications", async () => {
    const order = await createTestOrder(200.0, 20.0);

    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    // Primeiro webhook
    const res1 = await processPaymentWebhook({
      gatewayName: "TEST",
      rawBody: JSON.stringify({
        event: "PAYMENT_APPROVED",
        transactionId: payment.transactionId!,
      }),
      headers: {},
    });
    expect(res1.status).toBe("APPROVED");

    // Segundo webhook idêntico (duplicação comum de gateways)
    const res2 = await processPaymentWebhook({
      gatewayName: "TEST",
      rawBody: JSON.stringify({
        event: "PAYMENT_APPROVED",
        transactionId: payment.transactionId!,
      }),
      headers: {},
    });
    expect(res2.success).toBe(true);
    expect(res2.status).toBe("APPROVED");

    // Pedido continua PAID normalmente
    const ord = await prisma.order.findUnique({ where: { id: order.id } });
    expect(ord?.status).toBe("PAID");
  });

  it("should process Credit Card payment approval immediately in test mode", async () => {
    const order = await createTestOrder(320.0, 20.0);

    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "CREDIT_CARD",
      gatewayName: "TEST",
      cardToken: "tok_visa_card_valid",
      installments: 2,
    });

    expect(payment.status).toBe("APPROVED");
    expect(payment.paidAt).toBeDefined();

    const ord = await prisma.order.findUnique({ where: { id: order.id } });
    expect(ord?.status).toBe("PAID");
  });

  it("should allow cancelling a pending payment", async () => {
    const order = await createTestOrder(100.0, 10.0);

    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    const cancelledPayment = await cancelOrderPayment(payment.id, "Cancelado por inatividade");
    expect(cancelledPayment.status).toBe("CANCELLED");
    expect(cancelledPayment.cancelledAt).toBeDefined();
    expect(cancelledPayment.failureReason).toBe("Cancelado por inatividade");

    const inDb = await prisma.payment.findUnique({ where: { id: payment.id } });
    expect(inDb?.status).toBe("CANCELLED");
  });

  it("should refund an approved payment and update Order status to REFUNDED with Outbox event", async () => {
    const order = await createTestOrder(180.0, 30.0);

    // Criar e aprovar pagamento
    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "TEST_MODE",
      gatewayName: "TEST",
    });
    expect(payment.status).toBe("APPROVED");

    // Processar reembolso
    const refunded = await refundOrderPayment(payment.id, "Cliente exerceu direito de arrependimento");
    expect(refunded.status).toBe("REFUNDED");
    expect(refunded.refundedAt).toBeDefined();

    // Validar pedido atualizado para REFUNDED
    const ord = await prisma.order.findUnique({ where: { id: order.id } });
    expect(ord?.status).toBe("REFUNDED");

    // Validar Outbox Event ORDER_REFUNDED
    const outboxOrderRefund = await prisma.outboxEvent.findFirst({
      where: {
        entityType: "Order",
        entityId: order.id,
        eventType: DOMAIN_EVENTS.ORDER_REFUNDED,
      },
    });
    expect(outboxOrderRefund).toBeDefined();
  });

  it("CONCURRENCY: should handle simultaneous payment creations safely without duplicate payments", async () => {
    const order = await createTestOrder(250.0, 20.0);
    const sharedIdempotencyKey = `concurrent_test_key_${order.id}`;

    // Disparar duas requisições simultaneamente competindo pela mesma chave de idempotência
    const [res1, res2] = await Promise.all([
      createCheckoutPayment({
        orderId: order.id,
        method: "PIX",
        gatewayName: "TEST",
        idempotencyKey: sharedIdempotencyKey,
      }),
      createCheckoutPayment({
        orderId: order.id,
        method: "PIX",
        gatewayName: "TEST",
        idempotencyKey: sharedIdempotencyKey,
      }),
    ]);

    // Ambas as requisições devem retornar o mesmo pagamento de forma consistente
    expect(res1.payment.id).toBeDefined();
    expect(res2.payment.id).toBeDefined();
    expect(res1.payment.id).toBe(res2.payment.id);
    expect(res1.payment.idempotencyKey).toBe(sharedIdempotencyKey);
    expect(res2.payment.idempotencyKey).toBe(sharedIdempotencyKey);

    // No banco de dados, deve existir estritamente 1 único registro de Payment
    const totalPaymentsInDb = await prisma.payment.count({
      where: { orderId: order.id },
    });
    expect(totalPaymentsInDb).toBe(1);
  });

  it("CONCURRENCY: should handle simultaneous webhook approval notifications safely without duplicating events", async () => {
    const order = await createTestOrder(190.0, 15.0);

    const { payment } = await createCheckoutPayment({
      orderId: order.id,
      method: "PIX",
      gatewayName: "TEST",
    });

    const webhookPayload = JSON.stringify({
      event: "PAYMENT_APPROVED",
      transactionId: payment.transactionId!,
    });

    // Disparar dois webhooks idênticos exatamente ao mesmo tempo
    const [webhookRes1, webhookRes2] = await Promise.all([
      processPaymentWebhook({
        gatewayName: "TEST",
        rawBody: webhookPayload,
        headers: {},
      }),
      processPaymentWebhook({
        gatewayName: "TEST",
        rawBody: webhookPayload,
        headers: {},
      }),
    ]);

    expect(webhookRes1.success).toBe(true);
    expect(webhookRes2.success).toBe(true);

    // O pedido deve estar PAID
    const ord = await prisma.order.findUnique({
      where: { id: order.id },
      include: { statusHistory: true },
    });
    expect(ord?.status).toBe("PAID");

    // Deve existir apenas 1 registro de aprovação no histórico de status
    const paidHistoryEntries = ord?.statusHistory.filter((h) => h.newStatus === "PAID");
    expect(paidHistoryEntries?.length).toBe(1);

    // Deve existir estritamente 1 evento PAYMENT_APPROVED e 1 evento ORDER_PAID na Outbox
    const paymentApprovedEvents = await prisma.outboxEvent.findMany({
      where: {
        entityType: "Payment",
        entityId: payment.id,
        eventType: DOMAIN_EVENTS.PAYMENT_APPROVED,
      },
    });
    expect(paymentApprovedEvents.length).toBe(1);

    const orderPaidEvents = await prisma.outboxEvent.findMany({
      where: {
        entityType: "Order",
        entityId: order.id,
        eventType: DOMAIN_EVENTS.ORDER_PAID,
      },
    });
    expect(orderPaidEvents.length).toBe(1);
  });
});

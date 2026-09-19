import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "../../src/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  updateFulfillmentTracking,
  markFulfillmentDelivered,
  cancelFulfillmentOrder,
  retryFulfillmentOrder,
} from "../../src/modules/fulfillment/service";
import { DOMAIN_EVENTS } from "../../src/modules/automations/events";
import { FulfillmentStatus, OrderStatus } from "@prisma/client";

describe("Fulfillment & Multi-Supplier Integration Tests", () => {
  let supplierAId: string;
  let supplierBId: string;
  let categoryId: string;
  let productAId: string;
  let productBId: string;
  let customerId: string;

  beforeAll(async () => {
    // 1. Criar Fornecedores de Teste
    const supA = await prisma.supplier.create({
      data: { name: "TEST_SUPPLIER_ALPHA" },
    });
    supplierAId = supA.id;

    const supB = await prisma.supplier.create({
      data: { name: "TEST_SUPPLIER_BETA" },
    });
    supplierBId = supB.id;

    // 2. Criar Categoria
    const cat = await prisma.category.create({
      data: {
        name: "TEST_CAT_FULFILLMENT",
        slug: `test-cat-ful-${Date.now()}`,
      },
    });
    categoryId = cat.id;

    // 3. Criar Produtos com Fornecedores Diferentes
    const prodA = await prisma.product.create({
      data: {
        name: "Produto Alpha Drop",
        slug: `prod-alpha-${Date.now()}`,
        sku: `SKU-ALPHA-${Date.now()}`,
        description: "Produto do Fornecedor Alpha",
        costPrice: 40.0,
        sellingPrice: 99.0,
        stock: 50,
        supplierId: supplierAId,
        categoryId: categoryId,
      },
    });
    productAId = prodA.id;

    const prodB = await prisma.product.create({
      data: {
        name: "Produto Beta Drop",
        slug: `prod-beta-${Date.now()}`,
        sku: `SKU-BETA-${Date.now()}`,
        description: "Produto do Fornecedor Beta",
        costPrice: 60.0,
        sellingPrice: 150.0,
        stock: 50,
        supplierId: supplierBId,
        categoryId: categoryId,
      },
    });
    productBId = prodB.id;

    // 4. Criar Cliente com Endereço
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente Fulfillment Teste",
        email: `client.ful.${Date.now()}@example.com`,
        cpf: `999${Date.now().toString().slice(-8)}`,
        phone: "11977776666",
        addresses: {
          create: {
            street: "Avenida Paulista",
            number: "1000",
            neighborhood: "Bela Vista",
            city: "São Paulo",
            state: "SP",
            postalCode: "01310100",
            isDefault: true,
          },
        },
      },
    });
    customerId = customer.id;
  });

  afterAll(async () => {
    // Cleanup cascade
    await prisma.fulfillmentHistory.deleteMany({
      where: { fulfillmentOrder: { order: { customerId } } },
    });
    await prisma.tracking.deleteMany({
      where: { shipment: { order: { customerId } } },
    });
    await prisma.shipment.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.fulfillmentItem.deleteMany({
      where: { fulfillmentOrder: { order: { customerId } } },
    });
    await prisma.fulfillmentOrder.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.payment.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.orderStatusHistory.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.orderItem.deleteMany({
      where: { order: { customerId } },
    });
    await prisma.order.deleteMany({
      where: { customerId },
    });
    await prisma.customerAddress.deleteMany({
      where: { customerId },
    });
    await prisma.customer.deleteMany({
      where: { id: customerId },
    });
    await prisma.product.deleteMany({
      where: { id: { in: [productAId, productBId] } },
    });
    await prisma.category.deleteMany({
      where: { id: categoryId },
    });
    await prisma.supplier.deleteMany({
      where: { id: { in: [supplierAId, supplierBId] } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { entityType: "FulfillmentOrder" },
    });
  });

  // Helper para criar pedido pago de teste (com produtos dos fornecedores escolhidos)
  async function createTestPaidOrder(options?: {
    withSupplierA?: boolean;
    withSupplierB?: boolean;
    status?: OrderStatus;
  }) {
    const withA = options?.withSupplierA !== false;
    const withB = options?.withSupplierB ?? false;
    const status = options?.status ?? OrderStatus.PAID;

    const itemsData = [];
    let subtotal = 0;
    let totalCost = 0;

    if (withA) {
      itemsData.push({
        productId: productAId,
        sku: "SKU-ALPHA-SNAP",
        name: "Produto Alpha Drop",
        unitCost: 40.0,
        unitPrice: 99.0,
        quantity: 1,
        totalCost: 40.0,
        totalPrice: 99.0,
        profit: 59.0,
      });
      subtotal += 99.0;
      totalCost += 40.0;
    }

    if (withB) {
      itemsData.push({
        productId: productBId,
        sku: "SKU-BETA-SNAP",
        name: "Produto Beta Drop",
        unitCost: 60.0,
        unitPrice: 150.0,
        quantity: 2,
        totalCost: 120.0,
        totalPrice: 300.0,
        profit: 180.0,
      });
      subtotal += 300.0;
      totalCost += 120.0;
    }

    const totalAmount = subtotal + 20.0; // Frete 20

    const orderNumber = `DH-TEST-FUL-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    return prisma.order.create({
      data: {
        orderNumber,
        customerId,
        status,
        subtotalAmount: subtotal,
        shippingCost: 20.0,
        discountAmount: 0.0,
        totalAmount,
        totalCostAmount: totalCost,
        estimatedProfit: totalAmount - totalCost,
        marginPercentage: ((totalAmount - totalCost) / totalAmount) * 100,
        markupPercentage: ((totalAmount - totalCost) / totalCost) * 100,
        shippingAddress: {
          recipientName: "Cliente Fulfillment Teste",
          street: "Avenida Paulista",
          number: "1000",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310100",
        },
        items: {
          create: itemsData,
        },
      },
      include: {
        items: true,
      },
    });
  }

  it("should reject fulfillment creation for unpaid orders (AWAITING_PAYMENT)", async () => {
    const unpaidOrder = await createTestPaidOrder({ status: OrderStatus.AWAITING_PAYMENT });

    await expect(createFulfillmentsForOrder(unpaidOrder.id)).rejects.toThrow("ORDER_NOT_PAID");
  });

  it("should create fulfillment order and preserve immutable unitCostSnapshot from OrderItem", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });

    const result = await createFulfillmentsForOrder(order.id);

    expect(result.fulfillments.length).toBe(1);
    const fulSummary = result.fulfillments[0];

    expect(fulSummary.orderId).toBe(order.id);
    expect(fulSummary.supplierId).toBe(supplierAId);
    expect(fulSummary.status).toBe(FulfillmentStatus.PENDING);

    // Buscar no banco com items completos
    const ful = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulSummary.id },
      include: { items: true },
    });

    expect(ful).toBeDefined();
    expect(ful!.items.length).toBe(1);

    // Validar snapshot financeiro
    expect(Number(ful!.items[0].unitCostSnapshot)).toBe(40.0);
    expect(ful!.items[0].sku).toBe("SKU-ALPHA-SNAP");

    // Validar histórico de auditoria
    const history = await prisma.fulfillmentHistory.findMany({
      where: { fulfillmentOrderId: ful!.id },
    });
    expect(history.length).toBe(1);
    expect(history[0].newStatus).toBe(FulfillmentStatus.PENDING);
  });

  it("MULTI-SUPPLIER: should split 1 Order with 2 suppliers into 2 independent FulfillmentOrders", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: true });

    const result = await createFulfillmentsForOrder(order.id);

    expect(result.fulfillments.length).toBe(2);

    const fulSummaryA = result.fulfillments.find((f) => f.supplierId === supplierAId);
    const fulSummaryB = result.fulfillments.find((f) => f.supplierId === supplierBId);

    expect(fulSummaryA).toBeDefined();
    expect(fulSummaryB).toBeDefined();

    const fulA = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulSummaryA!.id },
      include: { items: true },
    });
    const fulB = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulSummaryB!.id },
      include: { items: true },
    });

    expect(fulA?.items.length).toBe(1);
    expect(fulA?.items[0].productId).toBe(productAId);
    expect(Number(fulA?.items[0].unitCostSnapshot)).toBe(40.0);

    expect(fulB?.items.length).toBe(1);
    expect(fulB?.items[0].productId).toBe(productBId);
    expect(fulB?.items[0].quantity).toBe(2);
    expect(Number(fulB?.items[0].unitCostSnapshot)).toBe(60.0);
  });

  it("IDEMPOTENCY & CONCURRENCY: simultaneous fulfillment creations do not duplicate records", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });

    // Disparar duas chamadas simultâneas
    const [res1, res2] = await Promise.all([
      createFulfillmentsForOrder(order.id),
      createFulfillmentsForOrder(order.id),
    ]);

    expect(res1.fulfillments.length).toBe(1);
    expect(res2.fulfillments.length).toBe(1);
    expect(res1.fulfillments[0].id).toBe(res2.fulfillments[0].id);

    // No banco de dados, deve existir estritamente 1 registro para essa combinação (orderId, supplierId)
    const count = await prisma.fulfillmentOrder.count({
      where: { orderId: order.id, supplierId: supplierAId },
    });
    expect(count).toBe(1);
  });

  it("should submit fulfillment order to supplier adapter, save external IDs, and emit Outbox event", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });
    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const ful = fulfillments[0];

    const submitRes = await submitFulfillmentOrder(ful.id);

    expect(submitRes.success).toBe(true);
    expect(submitRes.fulfillment.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(submitRes.fulfillment.externalOrderId).toMatch(/^EXT-/);
    expect(submitRes.fulfillment.supplierOrderNumber).toMatch(/^SUP-/);
    expect(submitRes.fulfillment.submittedAt).toBeDefined();
    expect(submitRes.fulfillment.attempts).toBe(1);

    // Validar Outbox Event
    const outboxSubmitted = await prisma.outboxEvent.findFirst({
      where: {
        entityType: "FulfillmentOrder",
        entityId: ful.id,
        eventType: DOMAIN_EVENTS.FULFILLMENT_SUBMITTED,
      },
    });
    expect(outboxSubmitted).toBeDefined();

    // Validar se o Pedido PAI transitou para SENT_TO_SUPPLIER
    const parentOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(parentOrder?.status).toBe(OrderStatus.SENT_TO_SUPPLIER);
  });

  it("should handle supplier failure, record error, calculate backoff, and allow retry", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });
    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const ful = fulfillments[0];

    // Submeter com flag para simular falha
    const failRes = await submitFulfillmentOrder(ful.id, {
      simulatedFailure: true,
      failureMessage: "Fornecedor temporariamente indisponível",
    });

    expect(failRes.success).toBe(false);
    expect(failRes.fulfillment.status).toBe(FulfillmentStatus.PENDING); // Retries pending (attempts < maxAttempts)
    expect(failRes.fulfillment.failureReason).toBe("Fornecedor temporariamente indisponível");
    expect(failRes.fulfillment.attempts).toBe(1);
    expect(failRes.fulfillment.nextAttemptAt).toBeDefined();

    // Validar Outbox Event FULFILLMENT_FAILED
    const outboxFailed = await prisma.outboxEvent.findFirst({
      where: {
        entityType: "FulfillmentOrder",
        entityId: ful.id,
        eventType: DOMAIN_EVENTS.FULFILLMENT_FAILED,
      },
    });
    expect(outboxFailed).toBeDefined();

    // Executar Retry com sucesso
    const retryRes = await retryFulfillmentOrder(ful.id);

    expect(retryRes.success).toBe(true);
    expect(retryRes.fulfillment.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(retryRes.fulfillment.attempts).toBe(2);
    expect(retryRes.fulfillment.failureReason).toBeNull();
  });

  it("should update tracking, create Shipment, and orchestrate parent Order status to SHIPPED and DELIVERED", async () => {
    // Pedido com 2 fornecedores para testar transição coordenada do Pedido Pai
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: true });
    const { fulfillments } = await createFulfillmentsForOrder(order.id);

    const fulA = fulfillments.find((f) => f.supplierId === supplierAId)!;
    const fulB = fulfillments.find((f) => f.supplierId === supplierBId)!;

    // Submeter ambos
    await submitFulfillmentOrder(fulA.id);
    await submitFulfillmentOrder(fulB.id);

    // 1. Atualizar rastreio apenas do Fornecedor A
    const trackResA = await updateFulfillmentTracking(fulA.id, {
      trackingNumber: "BR111111111BR",
      carrier: "Correios",
      trackingUrl: "https://correios.com.br/rastreio/BR111111111BR",
    });

    expect(trackResA.fulfillment.status).toBe(FulfillmentStatus.SHIPPED);
    expect(trackResA.shipment).toBeDefined();
    expect(trackResA.shipment.trackingNumber).toBe("BR111111111BR");

    // Validar que Shipment foi criado no banco
    const shipmentA = await prisma.shipment.findFirst({
      where: { fulfillmentOrderId: fulA.id },
    });
    expect(shipmentA).toBeDefined();
    expect(shipmentA?.trackingNumber).toBe("BR111111111BR");

    // IMPORTANTE: Pedido Pai NÃO deve estar SHIPPED ainda (pois o Fornecedor B ainda não despachou)
    const orderPartial = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderPartial?.status).toBe(OrderStatus.SENT_TO_SUPPLIER);

    // 2. Agora atualizar rastreio do Fornecedor B
    await updateFulfillmentTracking(fulB.id, {
      trackingNumber: "BR222222222BR",
      carrier: "Loggi",
    });

    // Agora que TODOS os fulfillments foram despachados, Pedido Pai DEVE ser SHIPPED
    const orderFullShipped = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderFullShipped?.status).toBe(OrderStatus.SHIPPED);

    // 3. Marcar Fornecedor A como DELIVERED
    await markFulfillmentDelivered(fulA.id);
    const orderPartialDelivered = await prisma.order.findUnique({ where: { id: order.id } });
    // Permanece SHIPPED até que o B também seja entregue
    expect(orderPartialDelivered?.status).toBe(OrderStatus.SHIPPED);

    // 4. Marcar Fornecedor B como DELIVERED
    await markFulfillmentDelivered(fulB.id);
    const orderFullDelivered = await prisma.order.findUnique({ where: { id: order.id } });
    // Agora que TODOS foram entregues, Pedido Pai DEVE ser DELIVERED
    expect(orderFullDelivered?.status).toBe(OrderStatus.DELIVERED);
  });

  it("should allow cancelling a fulfillment order and emit FULFILLMENT_CANCELLED", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });
    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const ful = fulfillments[0];

    const cancelled = await cancelFulfillmentOrder(ful.id, "Cancelamento solicitado pelo cliente");

    expect(cancelled.status).toBe(FulfillmentStatus.CANCELLED);
    expect(cancelled.cancelledAt).toBeDefined();

    // Validar Outbox Event
    const outboxCancelled = await prisma.outboxEvent.findFirst({
      where: {
        entityType: "FulfillmentOrder",
        entityId: ful.id,
        eventType: DOMAIN_EVENTS.FULFILLMENT_CANCELLED,
      },
    });
    expect(outboxCancelled).toBeDefined();
  });

  it("SNAPSHOT IMMUTABILITY: product cost price modifications in catalog must not alter existing fulfillment item snapshots", async () => {
    const order = await createTestPaidOrder({ withSupplierA: true, withSupplierB: false });
    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const ful = fulfillments[0];

    const fulInDb = await prisma.fulfillmentOrder.findUnique({
      where: { id: ful.id },
      include: { items: true },
    });

    const originalUnitCost = Number(fulInDb!.items[0].unitCostSnapshot);
    expect(originalUnitCost).toBe(40.0);

    // Atualizar o custo do produto no catálogo para R$ 75.00
    await prisma.product.update({
      where: { id: productAId },
      data: { costPrice: 75.0 },
    });

    // Submeter e verificar fulfillment
    const submitRes = await submitFulfillmentOrder(ful.id);
    const fulItemInDb = await prisma.fulfillmentItem.findFirst({
      where: { fulfillmentOrderId: submitRes.fulfillment.id },
    });

    // O snapshot no fulfillment item DEVE continuar estritamente 40.0
    expect(Number(fulItemInDb?.unitCostSnapshot)).toBe(40.0);

    // Restaurar custo do produto
    await prisma.product.update({
      where: { id: productAId },
      data: { costPrice: 40.0 },
    });
  });
});

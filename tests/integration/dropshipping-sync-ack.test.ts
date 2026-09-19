import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  syncFulfillmentStatusFromSupplier,
} from "@/modules/fulfillment/service";
import { getTestSupplierAdapter } from "@/modules/fulfillment/supplier-factory";
import { OrderStatus, FulfillmentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping Supplier Sync ACKNOWLEDGED State Tests", () => {
  let customer: any;
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Sync Ack",
        email: `sync_ack_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11988887777",
      },
    });

    supplier = await prisma.supplier.create({
      data: { name: `Fornecedor Ack ${Date.now()}` },
    });

    product = await prisma.product.create({
      data: {
        name: "Webcam Full HD",
        slug: `webcam-${Date.now()}`,
        sku: `SKU-WEBCAM-${Date.now()}`,
        description: "Webcam para streaming",
        costPrice: new Decimal(90.0),
        sellingPrice: new Decimal(200.0),
        stock: 40,
        supplierId: supplier.id,
      },
    });
  });

  it("should process ACKNOWLEDGED status returned from supplier sync and advance fulfillment & parent order", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-ACK-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(200.0),
        totalAmount: new Decimal(200.0),
        totalCostAmount: new Decimal(90.0),
        estimatedProfit: new Decimal(110.0),
        marginPercentage: new Decimal(55.0),
        markupPercentage: new Decimal(122.2),
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
              profit: new Decimal(110.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // 1. Submeter fulfillment
    const submitRes = await submitFulfillmentOrder(fulfillmentId);
    expect(submitRes.success).toBe(true);
    expect(submitRes.fulfillment.status).toBe(FulfillmentStatus.ACKNOWLEDGED);

    // 2. Simular que o fulfillment estava em SUBMITTED (aguardando confirmação assíncrona do fornecedor)
    await prisma.fulfillmentOrder.update({
      where: { id: fulfillmentId },
      data: { status: FulfillmentStatus.SUBMITTED, acknowledgedAt: null },
    });

    // Configurar o adapter de teste para retornar status ACKNOWLEDGED
    const adapter = getTestSupplierAdapter();
    adapter.setSimulatedStatus(FulfillmentStatus.ACKNOWLEDGED);

    // 3. Executar sincronização de status com o fornecedor
    const syncRes = await syncFulfillmentStatusFromSupplier(fulfillmentId);
    expect(syncRes.success).toBe(true);
    expect(syncRes.updated).toBe(true);
    expect(syncRes.status).toBe(FulfillmentStatus.ACKNOWLEDGED);

    // 4. Validar que o banco refletiu o ACKNOWLEDGED e registrou histórico de auditoria
    const fulfillmentInDb = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulfillmentId },
      include: { history: { orderBy: { createdAt: "desc" } } },
    });

    expect(fulfillmentInDb?.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(fulfillmentInDb?.acknowledgedAt).toBeDefined();
    expect(fulfillmentInDb?.history.some((h) => h.newStatus === FulfillmentStatus.ACKNOWLEDGED)).toBe(true);

    // 5. Validar que o pedido pai avançou para SENT_TO_SUPPLIER
    const parentOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(parentOrder?.status).toBe(OrderStatus.SENT_TO_SUPPLIER);
  });

  it("2. should strictly respect progressive state transitions: PENDING -> SUBMITTED -> ACKNOWLEDGED -> SHIPPED -> DELIVERED via supplier sync", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-STATE-SEQ-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(200.0),
        totalAmount: new Decimal(200.0),
        totalCostAmount: new Decimal(90.0),
        estimatedProfit: new Decimal(110.0),
        marginPercentage: new Decimal(55.0),
        markupPercentage: new Decimal(122.2),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.PENDING,
        externalOrderId: `EXT-SEQ-${Date.now()}`,
      },
    });

    const adapter = getTestSupplierAdapter();

    // 1. Fornecedor reporta SUBMITTED (em fila de processamento)
    adapter.setSimulatedStatus(FulfillmentStatus.SUBMITTED);
    const sync1 = await syncFulfillmentStatusFromSupplier(fulfillment.id);
    expect(sync1.success).toBe(true);
    expect(sync1.updated).toBe(true);
    expect(sync1.status).toBe(FulfillmentStatus.SUBMITTED);

    let fDb = await prisma.fulfillmentOrder.findUnique({ where: { id: fulfillment.id } });
    expect(fDb?.status).toBe(FulfillmentStatus.SUBMITTED);
    expect(fDb?.submittedAt).toBeDefined();

    // 2. Fornecedor reporta ACKNOWLEDGED (aceito pelo ERP do fornecedor)
    adapter.setSimulatedStatus(FulfillmentStatus.ACKNOWLEDGED);
    const sync2 = await syncFulfillmentStatusFromSupplier(fulfillment.id);
    expect(sync2.success).toBe(true);
    expect(sync2.updated).toBe(true);
    expect(sync2.status).toBe(FulfillmentStatus.ACKNOWLEDGED);

    fDb = await prisma.fulfillmentOrder.findUnique({ where: { id: fulfillment.id } });
    expect(fDb?.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
    expect(fDb?.acknowledgedAt).toBeDefined();

    // 3. Fornecedor reporta SHIPPED (despachado com rastreio)
    adapter.setSimulatedStatus(FulfillmentStatus.SHIPPED);
    adapter.setCustomTracking(`BR${Date.now()}SEQ`, "Correios");
    const sync3 = await syncFulfillmentStatusFromSupplier(fulfillment.id);
    expect(sync3.success).toBe(true);
    expect(sync3.updated).toBe(true);
    expect(sync3.status).toBe(FulfillmentStatus.SHIPPED);

    fDb = await prisma.fulfillmentOrder.findUnique({ where: { id: fulfillment.id } });
    expect(fDb?.status).toBe(FulfillmentStatus.SHIPPED);
    expect(fDb?.shippedAt).toBeDefined();

    // 4. Fornecedor reporta DELIVERED (entregue ao cliente final)
    adapter.setSimulatedStatus(FulfillmentStatus.DELIVERED);
    const sync4 = await syncFulfillmentStatusFromSupplier(fulfillment.id);
    expect(sync4.success).toBe(true);
    expect(sync4.updated).toBe(true);
    expect(sync4.status).toBe(FulfillmentStatus.DELIVERED);

    fDb = await prisma.fulfillmentOrder.findUnique({ where: { id: fulfillment.id } });
    expect(fDb?.status).toBe(FulfillmentStatus.DELIVERED);
    expect(fDb?.deliveredAt).toBeDefined();

    // Validar Pedido Pai DELIVERED
    const parentOrder = await prisma.order.findUnique({ where: { id: order.id } });
    expect(parentOrder?.status).toBe(OrderStatus.DELIVERED);

    // 5. Tentativa de nova sincronização após estado terminal DELIVERED deve manter status sem erro
    const sync5 = await syncFulfillmentStatusFromSupplier(fulfillment.id);
    expect(sync5.success).toBe(true);
    expect(sync5.updated).toBe(false);
    expect(sync5.message).toContain("terminal DELIVERED");
  });
});

import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  cancelFulfillmentOrder,
} from "@/modules/fulfillment/service";
import { refundOrderPayment } from "@/modules/payments/service";
import { OrderStatus, FulfillmentStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Dropshipping Cancellation & Refund Segregation Tests", () => {
  let customer: any;
  let supplier: any;
  let product: any;

  beforeEach(async () => {
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Cancelamento",
        email: `cancel_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11977771111",
      },
    });

    supplier = await prisma.supplier.create({
      data: { name: `Fornecedor Cancel ${Date.now()}` },
    });

    product = await prisma.product.create({
      data: {
        name: "Produto Cancelavel",
        slug: `prod-cancel-${Date.now()}`,
        sku: `SKU-CANCEL-${Date.now()}`,
        description: "Desc",
        costPrice: new Decimal(20.0),
        sellingPrice: new Decimal(60.0),
        stock: 50,
        supplierId: supplier.id,
      },
    });
  });

  it("1. should cancel fulfillment before submission without calling external provider", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CANC-BEFORE-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
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
              profit: new Decimal(40.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    const cancelled = await cancelFulfillmentOrder(
      fulfillmentId,
      "Cancelamento solicitado pelo cliente antes do envio ao fornecedor."
    );

    expect(cancelled.status).toBe(FulfillmentStatus.CANCELLED);
    expect(cancelled.cancelledAt).toBeDefined();

    const history = await prisma.fulfillmentHistory.findMany({
      where: { fulfillmentOrderId: fulfillmentId },
    });
    expect(history.some((h) => h.newStatus === FulfillmentStatus.CANCELLED)).toBe(true);
  });

  it("2. should cancel fulfillment after submission by triggering supplier cancellation", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CANC-AFTER-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
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
              profit: new Decimal(40.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // Submeter ao fornecedor
    await submitFulfillmentOrder(fulfillmentId);

    // Cancelar após envio
    const cancelled = await cancelFulfillmentOrder(
      fulfillmentId,
      "Cancelamento de pedido aprovado com fornecedor."
    );

    expect(cancelled.status).toBe(FulfillmentStatus.CANCELLED);
  });

  it("3. should segregate financial refund from physical inventory return", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-REFUND-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
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
              profit: new Decimal(40.0),
            },
          ],
        },
      },
    });

    const payment = await prisma.payment.create({
      data: {
        orderId: order.id,
        gateway: "TEST_GATEWAY",
        method: PaymentMethod.TEST_MODE,
        status: PaymentStatus.APPROVED,
        amount: new Decimal(60.0),
        transactionId: `TX_REF_${Date.now()}`,
      },
    });

    const initialStock = (await prisma.product.findUnique({ where: { id: product.id } }))!.stock;

    // Executar estorno financeiro
    await refundOrderPayment(payment.id, "Cliente solicitou cancelamento financeiro.");

    const orderDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderDb?.status).toBe(OrderStatus.REFUNDED);

    // O estoque físico NÃO deve ser alterado automaticamente pelo refund financeiro
    const currentStock = (await prisma.product.findUnique({ where: { id: product.id } }))!.stock;
    expect(currentStock).toBe(initialStock);
  });

  it("4. should switch supplier safely in PENDING/SUBMITTED and register complete audit log", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Substituto ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
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
              profit: new Decimal(40.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // Submeter ao fornecedor 1
    await submitFulfillmentOrder(fulfillmentId);

    // Executar troca para fornecedor substituto
    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");
    const switched = await switchFulfillmentSupplier(
      fulfillmentId,
      backupSupplier.id,
      "Fornecedor 1 sem estoque imediato. Migrado para fornecedor substituto.",
      "admin_user_id"
    );

    expect(switched.supplierId).toBe(backupSupplier.id);
    expect(switched.status).toBe(FulfillmentStatus.PENDING);
    expect(switched.attempts).toBe(0);
    expect(switched.externalOrderId).toBeNull();

    // Validar trilha de auditoria completa em FulfillmentHistory
    const histories = await prisma.fulfillmentHistory.findMany({
      where: { fulfillmentOrderId: fulfillmentId },
      orderBy: { createdAt: "desc" },
    });

    const switchHistory = histories.find((h) => h.reason?.includes("Troca de Fornecedor"));
    expect(switchHistory).toBeDefined();
    expect(switchHistory?.reason).toContain(supplier.name);
    expect(switchHistory?.reason).toContain(backupSupplier.name);
    expect(switchHistory?.changedByUserId).toBe("admin_user_id");
  });

  it("5. should block supplier switch if fulfillment is already SHIPPED or DELIVERED", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Block ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-BLOCKED-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.SHIPPED,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.SHIPPED,
      },
    });

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    await expect(
      switchFulfillmentSupplier(fulfillment.id, backupSupplier.id, "Tentativa de troca após despacho")
    ).rejects.toThrow("CANNOT_SWITCH_SUPPLIER_FOR_SHIPPED_OR_DELIVERED_ORDER");
  });

  it("6. should block supplier switch if order is CANCELLED or REFUNDED", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Block 2 ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-CANC-ORD-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.CANCELLED,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.PENDING,
      },
    });

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    await expect(
      switchFulfillmentSupplier(fulfillment.id, backupSupplier.id, "Tentativa de troca em pedido cancelado")
    ).rejects.toThrow("CANNOT_SWITCH_SUPPLIER_FOR_CANCELLED_OR_REFUNDED_ORDER");
  });

  it("7. should block supplier switch if fulfillment itself is CANCELLED", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Block 3 ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-CANC-FUL-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.CANCELLED,
      },
    });

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    await expect(
      switchFulfillmentSupplier(fulfillment.id, backupSupplier.id, "Tentativa de troca em fulfillment cancelado")
    ).rejects.toThrow("CANNOT_SWITCH_SUPPLIER_FOR_CANCELLED_FULFILLMENT");
  });

  it("8. should block supplier switch if fulfillment is DELIVERED", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Block 4 ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-DELIV-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.DELIVERED,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.DELIVERED,
      },
    });

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    await expect(
      switchFulfillmentSupplier(fulfillment.id, backupSupplier.id, "Tentativa de troca em pedido entregue")
    ).rejects.toThrow("CANNOT_SWITCH_SUPPLIER_FOR_SHIPPED_OR_DELIVERED_ORDER");
  });

  it("9. should allow supplier switch when fulfillment is in FAILED state and reset attempts cleanly", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Sucesso ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-FAILED-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.FAILED,
        attempts: 3,
        failureReason: "Fornecedor anterior offline por 3 tentativas consecutivas",
      },
    });

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    const switched = await switchFulfillmentSupplier(
      fulfillment.id,
      backupSupplier.id,
      "Fornecedor principal falhou. Migrado para fornecedor de contingência.",
      "operador_user_123"
    );

    expect(switched.supplierId).toBe(backupSupplier.id);
    expect(switched.status).toBe(FulfillmentStatus.PENDING);
    expect(switched.attempts).toBe(0);
    expect(switched.failureReason).toBeNull();
    expect(switched.nextAttemptAt).toBeNull();

    const histories = await prisma.fulfillmentHistory.findMany({
      where: { fulfillmentOrderId: fulfillment.id },
      orderBy: { createdAt: "desc" },
    });
    expect(histories[0].newStatus).toBe(FulfillmentStatus.PENDING);
    expect(histories[0].previousStatus).toBe(FulfillmentStatus.FAILED);
    expect(histories[0].changedByUserId).toBe("operador_user_123");
  });

  it("10. should block supplier switch if previous supplier adapter rejects order cancellation", async () => {
    const backupSupplier = await prisma.supplier.create({
      data: { name: `Fornecedor Reject ${Date.now()}` },
    });

    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-REJECT-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {},
      },
    });

    const fulfillment = await prisma.fulfillmentOrder.create({
      data: {
        orderId: order.id,
        supplierId: supplier.id,
        status: FulfillmentStatus.SUBMITTED,
        externalOrderId: "EXT-ORDER-ALREADY-PACKING",
      },
    });

    const { getTestSupplierAdapter } = await import("@/modules/fulfillment/supplier-factory");
    const adapter = getTestSupplierAdapter();
    adapter.setShouldFail(true, "Fornecedor recusou cancelamento: pacote em empacotamento na esteira");

    const { switchFulfillmentSupplier } = await import("@/modules/fulfillment/service");

    await expect(
      switchFulfillmentSupplier(fulfillment.id, backupSupplier.id, "Troca forçada")
    ).rejects.toThrow("FAILED_TO_CANCEL_PREVIOUS_SUPPLIER_ORDER");

    // Garantir que a ordem NÃO foi alterada no banco
    const fulfillmentAfter = await prisma.fulfillmentOrder.findUnique({
      where: { id: fulfillment.id },
    });
    expect(fulfillmentAfter?.supplierId).toBe(supplier.id);
    expect(fulfillmentAfter?.status).toBe(FulfillmentStatus.SUBMITTED);

    // Restaurar adapter
    adapter.setShouldFail(false);
  });
});

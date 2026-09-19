import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  updateFulfillmentTracking,
  markFulfillmentDelivered,
  addTrackingEventSafe,
  switchFulfillmentSupplier,
} from "@/modules/fulfillment/service";
import { OrderStatus, FulfillmentStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Fulfillment Orchestration & Dropshipping Unit Tests", () => {
  let customer: any;
  let supplierA: any;
  let supplierB: any;
  let productA: any;
  let productB: any;
  let productNoSupplier: any;

  beforeEach(async () => {
    // 1. Criar dados de teste limpos
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Dropshipping Teste",
        email: `cliente_ds_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11988887777",
      },
    });

    supplierA = await prisma.supplier.create({
      data: {
        name: `Fornecedor Alfa ${Date.now()}`,
        email: "alfa@fornecedor.com",
      },
    });

    supplierB = await prisma.supplier.create({
      data: {
        name: `Fornecedor Beta ${Date.now()}`,
        email: "beta@fornecedor.com",
      },
    });

    productA = await prisma.product.create({
      data: {
        name: "Produto Fornecedor Alfa",
        slug: `prod-alfa-${Date.now()}`,
        sku: `SKU-ALFA-${Date.now()}`,
        description: "Desc Alfa",
        costPrice: new Decimal(30.0),
        sellingPrice: new Decimal(80.0),
        stock: 50,
        supplierId: supplierA.id,
      },
    });

    productB = await prisma.product.create({
      data: {
        name: "Produto Fornecedor Beta",
        slug: `prod-beta-${Date.now()}`,
        sku: `SKU-BETA-${Date.now()}`,
        description: "Desc Beta",
        costPrice: new Decimal(45.0),
        sellingPrice: new Decimal(120.0),
        stock: 30,
        supplierId: supplierB.id,
      },
    });

    productNoSupplier = await prisma.product.create({
      data: {
        name: "Produto Sem Fornecedor",
        slug: `prod-nosup-${Date.now()}`,
        sku: `SKU-NOSUP-${Date.now()}`,
        description: "Desc Sem Fornecedor",
        costPrice: new Decimal(20.0),
        sellingPrice: new Decimal(60.0),
        stock: 10,
        supplierId: null,
      },
    });
  });

  afterEach(async () => {
    // Limpeza
  });

  it("1. should group items by supplier and capture immutable cost snapshots", async () => {
    // Criar pedido pago com itens do Fornecedor A e Fornecedor B
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-DS-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(200.0),
        shippingCost: new Decimal(0.0),
        discountAmount: new Decimal(0.0),
        totalAmount: new Decimal(200.0),
        totalCostAmount: new Decimal(75.0),
        estimatedProfit: new Decimal(125.0),
        marginPercentage: new Decimal(62.5),
        markupPercentage: new Decimal(166.6),
        shippingAddress: {
          street: "Av Paulista",
          number: "1000",
          neighborhood: "Bela Vista",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310100",
        },
        items: {
          create: [
            {
              productId: productA.id,
              sku: productA.sku,
              name: productA.name,
              unitCost: productA.costPrice,
              unitPrice: productA.sellingPrice,
              quantity: 1,
              totalCost: productA.costPrice,
              totalPrice: productA.sellingPrice,
              profit: new Decimal(50.0),
            },
            {
              productId: productB.id,
              sku: productB.sku,
              name: productB.name,
              unitCost: productB.costPrice,
              unitPrice: productB.sellingPrice,
              quantity: 1,
              totalCost: productB.costPrice,
              totalPrice: productB.sellingPrice,
              profit: new Decimal(75.0),
            },
          ],
        },
      },
    });

    const result = await createFulfillmentsForOrder(order.id);

    expect(result.totalFulfillments).toBe(2);
    expect(result.fulfillments.length).toBe(2);

    const fulfillmentsDb = await prisma.fulfillmentOrder.findMany({
      where: { orderId: order.id },
      include: { items: true, supplier: true, history: true },
    });

    expect(fulfillmentsDb.length).toBe(2);

    const fA = fulfillmentsDb.find((f) => f.supplierId === supplierA.id);
    const fB = fulfillmentsDb.find((f) => f.supplierId === supplierB.id);

    expect(fA).toBeDefined();
    expect(fB).toBeDefined();
    expect(fA?.items.length).toBe(1);
    expect(Number(fA?.items[0].unitCostSnapshot)).toBe(30.0);
    expect(fB?.items.length).toBe(1);
    expect(Number(fB?.items[0].unitCostSnapshot)).toBe(45.0);

    // Histórico de auditoria criado
    expect(fA?.history.length).toBeGreaterThan(0);
  });

  it("2. should handle unassigned supplier products as operational exceptions without submitting", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-DS-UNASSIGNED-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(60.0),
        totalAmount: new Decimal(60.0),
        totalCostAmount: new Decimal(20.0),
        estimatedProfit: new Decimal(40.0),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200.0),
        shippingAddress: {
          street: "Rua das Flores",
          number: "50",
          neighborhood: "Centro",
          city: "Campinas",
          state: "SP",
          postalCode: "13010000",
        },
        items: {
          create: [
            {
              productId: productNoSupplier.id,
              sku: productNoSupplier.sku,
              name: productNoSupplier.name,
              unitCost: productNoSupplier.costPrice,
              unitPrice: productNoSupplier.sellingPrice,
              quantity: 1,
              totalCost: productNoSupplier.costPrice,
              totalPrice: productNoSupplier.sellingPrice,
              profit: new Decimal(40.0),
            },
          ],
        },
      },
    });

    const result = await createFulfillmentsForOrder(order.id);
    expect(result.totalFulfillments).toBe(1);
    expect(result.fulfillments[0].supplierId).toBeNull();

    const fulfillment = await prisma.fulfillmentOrder.findFirst({
      where: { orderId: order.id },
    });

    expect(fulfillment?.supplierId).toBeNull();
    expect(fulfillment?.status).toBe(FulfillmentStatus.PENDING);
    expect(fulfillment?.failureReason).toContain("sem fornecedor vinculado");

    // Tentativa de submissão externa deve ser recusada com erro explícito
    await expect(submitFulfillmentOrder(fulfillment!.id)).rejects.toThrow(
      "UNASSIGNED_SUPPLIER_CANNOT_BE_SUBMITTED"
    );
  });

  it("3. should be strictly idempotent: calling createFulfillmentsForOrder twice produces no duplicates", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-DS-IDEM-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(80.0),
        totalAmount: new Decimal(80.0),
        totalCostAmount: new Decimal(30.0),
        estimatedProfit: new Decimal(50.0),
        marginPercentage: new Decimal(62.5),
        markupPercentage: new Decimal(166.6),
        shippingAddress: {
          street: "Rua A",
          number: "1",
          neighborhood: "Bairro",
          city: "São Paulo",
          state: "SP",
          postalCode: "01000000",
        },
        items: {
          create: [
            {
              productId: productA.id,
              sku: productA.sku,
              name: productA.name,
              unitCost: productA.costPrice,
              unitPrice: productA.sellingPrice,
              quantity: 1,
              totalCost: productA.costPrice,
              totalPrice: productA.sellingPrice,
              profit: new Decimal(50.0),
            },
          ],
        },
      },
    });

    const res1 = await createFulfillmentsForOrder(order.id);
    const res2 = await createFulfillmentsForOrder(order.id);

    expect(res1.totalFulfillments).toBe(1);
    expect(res2.totalFulfillments).toBe(1);
    expect(res1.fulfillments[0].id).toBe(res2.fulfillments[0].id);

    const count = await prisma.fulfillmentOrder.count({
      where: { orderId: order.id },
    });
    expect(count).toBe(1);
  });

  it("4. should append tracking events safely with deduplication", async () => {
    const shipment = await prisma.shipment.create({
      data: {
        order: {
          create: {
            orderNumber: `DH-SHP-${Date.now()}`,
            customerId: customer.id,
            status: OrderStatus.PAID,
            subtotalAmount: new Decimal(80.0),
            totalAmount: new Decimal(80.0),
            totalCostAmount: new Decimal(30.0),
            estimatedProfit: new Decimal(50.0),
            marginPercentage: new Decimal(62.5),
            markupPercentage: new Decimal(166.6),
            shippingAddress: {},
          },
        },
        carrier: "Correios",
        trackingNumber: `BR${Date.now()}DH`,
        status: "SHIPPED",
      },
    });

    const eventData = {
      status: "IN_TRANSIT",
      description: "Objeto em trânsito para a unidade de distribuição.",
      location: "CTE Cajamar - SP",
    };

    // Primeira inserção
    const t1 = await addTrackingEventSafe(shipment.id, eventData);
    expect(t1.id).toBeDefined();

    // Segunda inserção idêntica -> Retorna o evento existente sem duplicar
    const t2 = await addTrackingEventSafe(shipment.id, eventData);
    expect(t2.id).toBe(t1.id);

    const totalEvents = await prisma.tracking.count({
      where: { shipmentId: shipment.id },
    });
    expect(totalEvents).toBe(1);
  });

  it("5. should support operational supplier switch with audit history", async () => {
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-SWITCH-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(80.0),
        totalAmount: new Decimal(80.0),
        totalCostAmount: new Decimal(30.0),
        estimatedProfit: new Decimal(50.0),
        marginPercentage: new Decimal(62.5),
        markupPercentage: new Decimal(166.6),
        shippingAddress: {},
        items: {
          create: [
            {
              productId: productA.id,
              sku: productA.sku,
              name: productA.name,
              unitCost: productA.costPrice,
              unitPrice: productA.sellingPrice,
              quantity: 1,
              totalCost: productA.costPrice,
              totalPrice: productA.sellingPrice,
              profit: new Decimal(50.0),
            },
          ],
        },
      },
    });

    const { fulfillments } = await createFulfillmentsForOrder(order.id);
    const fulfillmentId = fulfillments[0].id;

    // Trocar de Fornecedor A para Fornecedor B
    const updated = await switchFulfillmentSupplier(
      fulfillmentId,
      supplierB.id,
      "Fornecedor A sem estoque imediato."
    );

    expect(updated.supplierId).toBe(supplierB.id);
    expect(updated.status).toBe(FulfillmentStatus.PENDING);
    expect(updated.attempts).toBe(0);

    const history = await prisma.fulfillmentHistory.findMany({
      where: { fulfillmentOrderId: fulfillmentId },
      orderBy: { createdAt: "desc" },
    });

    expect(history[0].reason).toContain("Troca de Fornecedor");
    expect(history[0].reason).toContain(supplierB.name);
  });
});

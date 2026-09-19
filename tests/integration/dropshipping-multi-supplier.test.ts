import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  createFulfillmentsForOrder,
  submitFulfillmentOrder,
  updateFulfillmentTracking,
  markFulfillmentDelivered,
} from "@/modules/fulfillment/service";
import { OrderStatus, FulfillmentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 15 — Multi-Supplier Dropshipping & Parent Order Status Matrix Tests", () => {
  let customer: any;
  let supplierX: any;
  let supplierY: any;
  let prodA: any;
  let prodB: any;
  let prodC: any;

  beforeEach(async () => {
    customer = await prisma.customer.create({
      data: {
        name: "Cliente Multi Fornecedor",
        email: `multi_${Date.now()}@teste.com`,
        cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
        phone: "11988884444",
      },
    });

    supplierX = await prisma.supplier.create({
      data: { name: `Fornecedor X ${Date.now()}` },
    });

    supplierY = await prisma.supplier.create({
      data: { name: `Fornecedor Y ${Date.now()}` },
    });

    prodA = await prisma.product.create({
      data: {
        name: "Produto A (Fornecedor X)",
        slug: `prod-a-x-${Date.now()}`,
        sku: `SKU-A-X-${Date.now()}`,
        description: "Desc A",
        costPrice: new Decimal(20.0),
        sellingPrice: new Decimal(50.0),
        stock: 40,
        supplierId: supplierX.id,
      },
    });

    prodB = await prisma.product.create({
      data: {
        name: "Produto B (Fornecedor X)",
        slug: `prod-b-x-${Date.now()}`,
        sku: `SKU-B-X-${Date.now()}`,
        description: "Desc B",
        costPrice: new Decimal(30.0),
        sellingPrice: new Decimal(70.0),
        stock: 40,
        supplierId: supplierX.id,
      },
    });

    prodC = await prisma.product.create({
      data: {
        name: "Produto C (Fornecedor Y)",
        slug: `prod-c-y-${Date.now()}`,
        sku: `SKU-C-Y-${Date.now()}`,
        description: "Desc C",
        costPrice: new Decimal(40.0),
        sellingPrice: new Decimal(100.0),
        stock: 40,
        supplierId: supplierY.id,
      },
    });
  });

  it("should create separate fulfillments per supplier and strictly require ALL fulfillments delivered for parent order DELIVERED", async () => {
    // 1. Criar pedido com itens de X e Y
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-MULTI-${Date.now()}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(220.0),
        totalAmount: new Decimal(220.0),
        totalCostAmount: new Decimal(90.0),
        estimatedProfit: new Decimal(130.0),
        marginPercentage: new Decimal(59.09),
        markupPercentage: new Decimal(144.44),
        shippingAddress: {},
        items: {
          create: [
            {
              productId: prodA.id,
              sku: prodA.sku,
              name: prodA.name,
              unitCost: prodA.costPrice,
              unitPrice: prodA.sellingPrice,
              quantity: 1,
              totalCost: prodA.costPrice,
              totalPrice: prodA.sellingPrice,
              profit: new Decimal(30.0),
            },
            {
              productId: prodB.id,
              sku: prodB.sku,
              name: prodB.name,
              unitCost: prodB.costPrice,
              unitPrice: prodB.sellingPrice,
              quantity: 1,
              totalCost: prodB.costPrice,
              totalPrice: prodB.sellingPrice,
              profit: new Decimal(40.0),
            },
            {
              productId: prodC.id,
              sku: prodC.sku,
              name: prodC.name,
              unitCost: prodC.costPrice,
              unitPrice: prodC.sellingPrice,
              quantity: 1,
              totalCost: prodC.costPrice,
              totalPrice: prodC.sellingPrice,
              profit: new Decimal(60.0),
            },
          ],
        },
      },
    });

    const createResult = await createFulfillmentsForOrder(order.id);
    expect(createResult.totalFulfillments).toBe(2);

    const fX = createResult.fulfillments.find((f) => f.supplierId === supplierX.id)!;
    const fY = createResult.fulfillments.find((f) => f.supplierId === supplierY.id)!;

    expect(fX.itemsCount).toBe(2); // Produto A + Produto B
    expect(fY.itemsCount).toBe(1); // Produto C

    // 2. Submeter ambos ao fornecedor
    await submitFulfillmentOrder(fX.id);
    await submitFulfillmentOrder(fY.id);

    // 3. Fornecedor X despacha com rastreio
    await updateFulfillmentTracking(fX.id, {
      carrier: "Correios",
      trackingNumber: `BR${Date.now()}X`,
    });

    // Pedido pai NÃO pode ser SHIPPED porque Y ainda está ACKNOWLEDGED/SUBMITTED
    let orderDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderDb?.status).not.toBe(OrderStatus.SHIPPED);

    // 4. Fornecedor Y despacha com rastreio
    await updateFulfillmentTracking(fY.id, {
      carrier: "J&T Express",
      trackingNumber: `JT${Date.now()}Y`,
    });

    // Agora que AMBOS estão SHIPPED, o pedido pai avança para SHIPPED
    orderDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderDb?.status).toBe(OrderStatus.SHIPPED);

    // 5. Fornecedor X entrega seu pacote (DELIVERED)
    await markFulfillmentDelivered(fX.id);

    // Pedido pai NÃO pode ser DELIVERED pois Y ainda está SHIPPED
    orderDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderDb?.status).toBe(OrderStatus.SHIPPED);
    expect(orderDb?.status).not.toBe(OrderStatus.DELIVERED);

    // 6. Fornecedor Y entrega seu pacote (DELIVERED)
    await markFulfillmentDelivered(fY.id);

    // Agora que TODOS os fulfillments foram entregues, o pedido pai avança para DELIVERED
    orderDb = await prisma.order.findUnique({ where: { id: order.id } });
    expect(orderDb?.status).toBe(OrderStatus.DELIVERED);
  });
});

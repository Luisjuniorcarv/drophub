import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { OrderStatus, PaymentStatus, PaymentMethod } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 5 — Customer, Orders & Financial Snapshot Integration Tests", () => {
  let testSupplierId: string;
  let testCategoryId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // Buscar fornecedor e categoria do seed
    const supplier = await prisma.supplier.findFirst();
    const category = await prisma.category.findFirst();

    if (!supplier || !category) {
      throw new Error("Seed data required before running integration tests");
    }

    testSupplierId = supplier.id;
    testCategoryId = category.id;

    // Criar cliente de teste
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente Teste Snapshot",
        email: `snapshot.test.${Date.now()}@example.com`,
        cpf: `123.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}-00`,
        phone: "(11) 98888-7777",
        addresses: {
          create: {
            street: "Rua Teste Snapshot",
            number: "100",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            postalCode: "01001-000",
            isDefault: true,
          },
        },
      },
      include: {
        addresses: true,
      },
    });

    testCustomerId = customer.id;
  });

  afterAll(async () => {
    if (testCustomerId) {
      const orders = await prisma.order.findMany({ where: { customerId: testCustomerId } });
      for (const o of orders) {
        await prisma.orderStatusHistory.deleteMany({ where: { orderId: o.id } });
        await prisma.payment.deleteMany({ where: { orderId: o.id } });
        await prisma.shipment.deleteMany({ where: { orderId: o.id } });
        await prisma.orderItem.deleteMany({ where: { orderId: o.id } });
        await prisma.order.delete({ where: { id: o.id } });
      }
      await prisma.customerAddress.deleteMany({ where: { customerId: testCustomerId } });
      await prisma.customer.delete({ where: { id: testCustomerId } }).catch(() => {});
    }
  });

  it("should perform customer address CRUD correctly", async () => {
    // Adicionar novo endereço secundário
    const newAddress = await prisma.customerAddress.create({
      data: {
        customerId: testCustomerId,
        street: "Avenida Secundária",
        number: "500",
        neighborhood: "Jardins",
        city: "São Paulo",
        state: "SP",
        postalCode: "01414-000",
        isDefault: false,
      },
    });

    expect(newAddress.id).toBeDefined();
    expect(newAddress.street).toBe("Avenida Secundária");

    // Atualizar endereço
    const updated = await prisma.customerAddress.update({
      where: { id: newAddress.id },
      data: { number: "502", complement: "Apto 12" },
    });
    expect(updated.number).toBe("502");
    expect(updated.complement).toBe("Apto 12");

    // Deletar endereço secundário
    await prisma.customerAddress.delete({ where: { id: newAddress.id } });
    const check = await prisma.customerAddress.findUnique({ where: { id: newAddress.id } });
    expect(check).toBeNull();
  });

  /**
   * TESTE OBRIGATÓRIO DE SNAPSHOT FINANCEIRO
   * 1. Criar produto com custo R$ 40 e preço R$ 100
   * 2. Criar pedido
   * 3. Alterar produto para custo R$ 60 e preço R$ 120
   * 4. Consultar pedido
   * 5. Confirmar que o pedido continua com custo R$ 40 e preço R$ 100
   */
  it("MANDATORY: should preserve exact financial snapshot on OrderItems after product price/cost changes", async () => {
    // 1. Criar produto com custo R$ 40 e preço R$ 100
    const snapshotProduct = await prisma.product.create({
      data: {
        name: "Produto Snapshot Teste",
        slug: `prod-snapshot-${Date.now()}`,
        sku: `SNAP-${Date.now()}`,
        description: "Produto para teste estrito de snapshot financeiro",
        costPrice: new Decimal(40.0),
        sellingPrice: new Decimal(100.0),
        stock: 50,
        supplierId: testSupplierId,
        categoryId: testCategoryId,
      },
    });

    expect(Number(snapshotProduct.costPrice)).toBe(40.0);
    expect(Number(snapshotProduct.sellingPrice)).toBe(100.0);

    // 2. Criar pedido com 2 unidades desse produto
    const quantity = 2;
    const unitCost = Number(snapshotProduct.costPrice); // 40
    const unitPrice = Number(snapshotProduct.sellingPrice); // 100
    const totalCost = unitCost * quantity; // 80
    const subtotal = unitPrice * quantity; // 200
    const shippingCost = 15.0;
    const discount = 0.0;
    const totalAmount = subtotal + shippingCost - discount; // 215
    const estimatedProfit = totalAmount - totalCost - shippingCost; // 120
    const margin = totalAmount > 0 ? (estimatedProfit / totalAmount) * 100 : 0;
    const markup = totalCost > 0 ? (estimatedProfit / totalCost) * 100 : 0;

    const orderNumber = `DH-TEST-SNAP-${Date.now().toString().slice(-4)}`;

    const order = await prisma.$transaction(async (tx) => {
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          customerId: testCustomerId,
          status: OrderStatus.AWAITING_PAYMENT,
          subtotalAmount: new Decimal(subtotal),
          shippingCost: new Decimal(shippingCost),
          discountAmount: new Decimal(discount),
          totalAmount: new Decimal(totalAmount),
          totalCostAmount: new Decimal(totalCost),
          estimatedProfit: new Decimal(estimatedProfit),
          marginPercentage: new Decimal(margin),
          markupPercentage: new Decimal(markup),
          shippingAddress: {
            street: "Rua Teste Snapshot",
            number: "100",
            city: "São Paulo",
            state: "SP",
            postalCode: "01001-000",
          },
          items: {
            create: [
              {
                productId: snapshotProduct.id,
                name: snapshotProduct.name,
                sku: snapshotProduct.sku,
                quantity,
                unitCost: new Decimal(unitCost),
                unitPrice: new Decimal(unitPrice),
                totalCost: new Decimal(totalCost),
                totalPrice: new Decimal(subtotal),
                profit: new Decimal(subtotal - totalCost),
              },
            ],
          },
          statusHistory: {
            create: {
              previousStatus: OrderStatus.AWAITING_PAYMENT,
              newStatus: OrderStatus.AWAITING_PAYMENT,
              reason: "Pedido de teste snapshot criado",
            },
          },
          payments: {
            create: {
              method: PaymentMethod.PIX,
              amount: new Decimal(totalAmount),
              status: PaymentStatus.PENDING,
            },
          },
        },
        include: {
          items: true,
          statusHistory: true,
          payments: true,
        },
      });

      return createdOrder;
    });

    expect(order.id).toBeDefined();
    expect(order.items.length).toBe(1);
    expect(Number(order.items[0].unitCost)).toBe(40.0);
    expect(Number(order.items[0].unitPrice)).toBe(100.0);
    expect(Number(order.items[0].totalCost)).toBe(80.0);
    expect(Number(order.items[0].totalPrice)).toBe(200.0);
    expect(Number(order.items[0].profit)).toBe(120.0);

    // 3. Alterar produto para custo R$ 60 e preço R$ 120
    const updatedProduct = await prisma.product.update({
      where: { id: snapshotProduct.id },
      data: {
        costPrice: new Decimal(60.0),
        sellingPrice: new Decimal(120.0),
        name: "Nome do Produto Modificado",
        sku: "SKU-MODIFICADO",
      },
    });

    expect(Number(updatedProduct.costPrice)).toBe(60.0);
    expect(Number(updatedProduct.sellingPrice)).toBe(120.0);

    // 4. Consultar pedido novamente do banco de dados
    const reloadedOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { items: true },
    });

    // 5. Confirmar que o pedido continua com custo R$ 40 e preço R$ 100
    expect(reloadedOrder).not.toBeNull();
    const itemSnapshot = reloadedOrder!.items[0];

    expect(Number(itemSnapshot.unitCost)).toBe(40.0);
    expect(Number(itemSnapshot.unitPrice)).toBe(100.0);
    expect(Number(itemSnapshot.totalCost)).toBe(80.0);
    expect(Number(itemSnapshot.totalPrice)).toBe(200.0);
    expect(Number(itemSnapshot.profit)).toBe(120.0);
    expect(itemSnapshot.name).toBe("Produto Snapshot Teste");
    expect(itemSnapshot.sku).toBe(snapshotProduct.sku);

    // Cleanup snapshot product & order
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
    await prisma.payment.deleteMany({ where: { orderId: order.id } });
    await prisma.orderItem.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
    await prisma.product.delete({ where: { id: snapshotProduct.id } });
  });

  it("should rollback completely if any step fails in order creation transaction", async () => {
    const initialOrderCount = await prisma.order.count();
    const initialItemCount = await prisma.orderItem.count();

    const faultyExecution = async () => {
      await prisma.$transaction(async (tx) => {
        // Criar pedido
        const newOrder = await tx.order.create({
          data: {
            orderNumber: `FAIL-TX-${Date.now()}`,
            customerId: testCustomerId,
            status: OrderStatus.AWAITING_PAYMENT,
            subtotalAmount: new Decimal(100),
            totalAmount: new Decimal(100),
            totalCostAmount: new Decimal(40),
            estimatedProfit: new Decimal(60),
            marginPercentage: new Decimal(60),
            markupPercentage: new Decimal(150),
            shippingAddress: { city: "SP" },
          },
        });

        // Tentar criar item com produto inexistente para forçar erro de Foreign Key
        await tx.orderItem.create({
          data: {
            orderId: newOrder.id,
            productId: "non-existent-product-id-99999",
            name: "Item Inválido",
            sku: "FAIL-SKU",
            quantity: 1,
            unitCost: new Decimal(40),
            unitPrice: new Decimal(100),
            totalCost: new Decimal(40),
            totalPrice: new Decimal(100),
            profit: new Decimal(60),
          },
        });
      });
    };

    await expect(faultyExecution()).rejects.toThrow();

    // Verificar que NADA foi gravado
    const currentOrderCount = await prisma.order.count();
    const currentItemCount = await prisma.orderItem.count();

    expect(currentOrderCount).toBe(initialOrderCount);
    expect(currentItemCount).toBe(initialItemCount);
  });

  it("should append status transitions strictly to OrderStatusHistory", async () => {
    // Criar pedido
    const order = await prisma.order.create({
      data: {
        orderNumber: `AUDIT-${Date.now()}`,
        customerId: testCustomerId,
        status: OrderStatus.AWAITING_PAYMENT,
        subtotalAmount: new Decimal(150),
        totalAmount: new Decimal(150),
        totalCostAmount: new Decimal(50),
        estimatedProfit: new Decimal(100),
        marginPercentage: new Decimal(66.6),
        markupPercentage: new Decimal(200),
        shippingAddress: { city: "São Paulo", state: "SP" },
        statusHistory: {
          create: {
            previousStatus: OrderStatus.AWAITING_PAYMENT,
            newStatus: OrderStatus.AWAITING_PAYMENT,
            reason: "Histórico inicial: Pedido criado",
          },
        },
      },
    });

    // Transição 1: PAID
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.PAID },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.AWAITING_PAYMENT,
          newStatus: OrderStatus.PAID,
          reason: "Pagamento Pix compensado",
        },
      });
    });

    // Transição 2: SHIPPED com Shipment
    await prisma.$transaction(async (tx) => {
      await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.SHIPPED },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: order.id,
          previousStatus: OrderStatus.PAID,
          newStatus: OrderStatus.SHIPPED,
          reason: "Código de rastreio gerado BR123456789BR",
        },
      });
      await tx.shipment.create({
        data: {
          orderId: order.id,
          carrier: "Correios",
          trackingNumber: "BR123456789BR",
          trackingUrl: "https://rastreamento.correios.com.br?code=BR123456789BR",
          status: "SHIPPED",
        },
      });
    });

    // Verificar histórico acumulado (3 registros, append-only)
    const history = await prisma.orderStatusHistory.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "asc" },
    });

    expect(history.length).toBe(3);
    expect(history[0].newStatus).toBe(OrderStatus.AWAITING_PAYMENT);
    expect(history[0].reason).toBe("Histórico inicial: Pedido criado");

    expect(history[1].newStatus).toBe(OrderStatus.PAID);
    expect(history[1].reason).toBe("Pagamento Pix compensado");

    expect(history[2].newStatus).toBe(OrderStatus.SHIPPED);
    expect(history[2].reason).toBe("Código de rastreio gerado BR123456789BR");

    // Limpar
    await prisma.orderStatusHistory.deleteMany({ where: { orderId: order.id } });
    await prisma.shipment.deleteMany({ where: { orderId: order.id } });
    await prisma.order.delete({ where: { id: order.id } });
  });
});

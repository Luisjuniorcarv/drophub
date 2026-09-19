import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus, PaymentMethod, PaymentStatus, ProductStatus } from "@prisma/client";

describe("Database & Prisma Integration Tests", () => {
  it("deve consultar o usuário administrador criado no seed", async () => {
    const admin = await prisma.user.findUnique({
      where: { email: "admin@drophub.com" },
    });

    expect(admin).not.toBeNull();
    expect(admin?.email).toBe("admin@drophub.com");
    expect(admin?.role).toBe("ADMIN");
  });

  it("deve criar e consultar um fornecedor", async () => {
    const supplier = await prisma.supplier.create({
      data: {
        name: "Fornecedor Teste Unitário",
        email: "teste@fornecedor.com",
        phone: "(11) 99999-0000",
        notes: "Fornecedor criado via teste de integração",
      },
    });

    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe("Fornecedor Teste Unitário");

    // Limpar
    await prisma.supplier.delete({ where: { id: supplier.id } });
  });

  it("deve criar um produto com Decimal e associar imagem", async () => {
    const category = await prisma.category.findFirst();
    const supplier = await prisma.supplier.findFirst();

    const product = await prisma.product.create({
      data: {
        name: "Produto Teste Decimal",
        slug: "produto-teste-decimal-" + Date.now(),
        sku: "TEST-DEC-" + Date.now(),
        description: "Descrição de produto de teste",
        costPrice: new Decimal("45.50"),
        sellingPrice: new Decimal("129.90"),
        stock: 20,
        status: ProductStatus.ACTIVE,
        categoryId: category?.id,
        supplierId: supplier?.id,
        images: {
          create: {
            url: "https://exemplo.com/imagem-teste.jpg",
            isCover: true,
          },
        },
      },
      include: {
        images: true,
        category: true,
      },
    });

    expect(product.id).toBeDefined();
    expect(Number(product.costPrice)).toBe(45.5);
    expect(Number(product.sellingPrice)).toBe(129.9);
    expect(product.images.length).toBe(1);

    // Limpar
    await prisma.product.delete({ where: { id: product.id } });
  });

  it("deve criar um cliente com endereço relacionado", async () => {
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente Teste Integração",
        email: `teste-${Date.now()}@exemplo.com`,
        cpf: "99988877766",
        phone: "(11) 98888-7777",
        addresses: {
          create: {
            street: "Rua Teste",
            number: "123",
            neighborhood: "Bairro Teste",
            city: "São Paulo",
            state: "SP",
            postalCode: "01001000",
          },
        },
      },
      include: { addresses: true },
    });

    expect(customer.id).toBeDefined();
    expect(customer.addresses.length).toBe(1);
    expect(customer.addresses[0].city).toBe("São Paulo");

    // Limpar
    await prisma.customer.delete({ where: { id: customer.id } });
  });

  it("deve criar um pedido com OrderItems, cálculo Decimal e histórico de status", async () => {
    let customer = await prisma.customer.findFirst();
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: "Cliente Auto Seed",
          email: `autoseed-${Date.now()}@exemplo.com`,
          cpf: `999${Date.now().toString().slice(-8)}`,
          phone: "11988887777",
        },
      });
    }

    let product = await prisma.product.findFirst();
    if (!product) {
      let supplier = await prisma.supplier.findFirst();
      if (!supplier) {
        supplier = await prisma.supplier.create({ data: { name: "Supplier Auto" } });
      }
      product = await prisma.product.create({
        data: {
          name: "Produto Auto Seed",
          slug: `prod-auto-${Date.now()}`,
          sku: `SKU-AUTO-${Date.now()}`,
          description: "Auto seed desc",
          costPrice: 50.0,
          sellingPrice: 120.0,
          stock: 10,
          supplierId: supplier.id,
        },
      });
    }

    let admin = await prisma.user.findFirst();
    if (!admin) {
      admin = await prisma.user.create({
        data: {
          name: "Admin Auto",
          email: "admin@drophub.local",
          passwordHash: "$2b$10$abcdefghijklmnopqrstuv",
          role: "ADMIN",
        },
      });
    }

    const unitPrice = Number(product.sellingPrice);
    const unitCost = Number(product.costPrice);
    const qty = 2;
    const subtotal = Number((unitPrice * qty).toFixed(2));
    const totalCost = Number((unitCost * qty).toFixed(2));
    const profit = Number((subtotal - totalCost).toFixed(2));
    const margin = Number(((profit / subtotal) * 100).toFixed(2));
    const markup = Number(((profit / totalCost) * 100).toFixed(2));

    const orderNumber = "TEST-ORD-" + Date.now();

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        status: OrderStatus.AWAITING_PAYMENT,
        subtotalAmount: new Decimal(subtotal),
        shippingCost: new Decimal("0.00"),
        totalAmount: new Decimal(subtotal),
        totalCostAmount: new Decimal(totalCost),
        estimatedProfit: new Decimal(profit),
        marginPercentage: new Decimal(margin),
        markupPercentage: new Decimal(markup),
        shippingAddress: {
          name: customer.name,
          street: "Rua Exemplo",
        },
        items: {
          create: {
            productId: product.id,
            sku: product.sku,
            name: product.name,
            unitCost: new Decimal(unitCost),
            unitPrice: new Decimal(unitPrice),
            quantity: qty,
            totalCost: new Decimal(totalCost),
            totalPrice: new Decimal(subtotal),
            profit: new Decimal(profit),
          },
        },
        payments: {
          create: {
            gateway: "TEST_GATEWAY",
            method: PaymentMethod.TEST_MODE,
            status: PaymentStatus.PENDING,
            amount: new Decimal(subtotal),
          },
        },
        statusHistory: {
          create: {
            previousStatus: OrderStatus.AWAITING_PAYMENT,
            newStatus: OrderStatus.AWAITING_PAYMENT,
            reason: "Criação de pedido para teste automatizado",
            changedByUserId: admin.id,
          },
        },
      },
      include: {
        items: true,
        payments: true,
        statusHistory: true,
      },
    });

    expect(order.id).toBeDefined();
    expect(order.items.length).toBe(1);
    expect(Number(order.totalAmount)).toBe(subtotal);
    expect(Number(order.totalCostAmount)).toBe(totalCost);
    expect(order.statusHistory.length).toBe(1);
    expect(order.statusHistory[0].changedByUserId).toBe(admin.id);

    // Testar transição de status para PAID com registro no histórico
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: OrderStatus.PAID,
        statusHistory: {
          create: {
            previousStatus: OrderStatus.AWAITING_PAYMENT,
            newStatus: OrderStatus.PAID,
            reason: "Pagamento aprovado em teste",
            changedByUserId: admin.id,
          },
        },
      },
      include: { statusHistory: true },
    });

    expect(updatedOrder.status).toBe(OrderStatus.PAID);
    expect(updatedOrder.statusHistory.length).toBe(2);

    // Limpar pedido de teste
    await prisma.order.delete({ where: { id: order.id } });
  });
});

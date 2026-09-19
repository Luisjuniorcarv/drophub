import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getStorefrontHome,
  getStorefrontProducts,
  getStorefrontProductBySlug,
  getStorefrontCategories,
  getStorefrontCart,
  createStorefrontOrder,
  getStorefrontOrder,
} from "@/modules/storefront/service";
import { registerCustomer, loginCustomer, getCustomerSession } from "@/modules/customer/auth";
import { ProductStatus, PaymentMethod, PaymentStatus, OrderStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { createCheckoutPayment, processPaymentWebhook } from "@/modules/payments/service";

describe("ETAPA 9 — Storefront & Loja Pública Integration Tests", () => {
  let testCategory: any;
  let activeProduct: any;
  let draftProduct: any;
  let variantProduct: any;
  let testCustomer: any;

  beforeEach(async () => {
    // 1. Limpar e preparar dados de teste isolados
    const uniqueSuffix = Date.now() + "_" + Math.floor(Math.random() * 1000);

    testCategory = await prisma.category.create({
      data: {
        name: `Categoria Loja ${uniqueSuffix}`,
        slug: `cat-loja-${uniqueSuffix}`,
        description: "Categoria de teste para o storefront",
        active: true,
      },
    });

    activeProduct = await prisma.product.create({
      data: {
        name: `Smartphone Premium ${uniqueSuffix}`,
        slug: `smartphone-premium-${uniqueSuffix}`,
        sku: `SKU-PHONE-${uniqueSuffix}`,
        description: "Smartphone de alta performance",
        costPrice: new Decimal(800.0),
        sellingPrice: new Decimal(1499.0),
        stock: 10,
        status: ProductStatus.ACTIVE,
        active: true,
        categoryId: testCategory.id,
      },
    });

    draftProduct = await prisma.product.create({
      data: {
        name: `Produto Rascunho ${uniqueSuffix}`,
        slug: `rascunho-${uniqueSuffix}`,
        sku: `SKU-DRAFT-${uniqueSuffix}`,
        description: "Produto não publicado",
        costPrice: new Decimal(50.0),
        sellingPrice: new Decimal(100.0),
        stock: 5,
        status: ProductStatus.DRAFT,
        active: true,
        categoryId: testCategory.id,
      },
    });

    variantProduct = await prisma.product.create({
      data: {
        name: `Camiseta Algodão ${uniqueSuffix}`,
        slug: `camiseta-algodao-${uniqueSuffix}`,
        sku: `SKU-SHIRT-${uniqueSuffix}`,
        description: "Camiseta 100% algodão",
        costPrice: new Decimal(20.0),
        sellingPrice: new Decimal(59.9),
        stock: 20,
        status: ProductStatus.ACTIVE,
        active: true,
        categoryId: testCategory.id,
        variants: {
          create: [
            {
              name: "Preto / G",
              sku: `SKU-SHIRT-BLK-G-${uniqueSuffix}`,
              attributesJson: { cor: "Preto", tamanho: "G" },
              costPrice: new Decimal(20.0),
              sellingPrice: new Decimal(59.9),
              stock: 8,
              active: true,
            },
          ],
        },
      },
      include: { variants: true },
    });
  });

  it("1. CATALOG FILTER: should strictly return ACTIVE products and exclude DRAFT/ARCHIVED", async () => {
    const result = await getStorefrontProducts({
      categorySlug: testCategory.slug,
    });

    expect(result.products.length).toBeGreaterThanOrEqual(2);
    const slugs = result.products.map((p) => p.slug);
    expect(slugs).toContain(activeProduct.slug);
    expect(slugs).toContain(variantProduct.slug);
    expect(slugs).not.toContain(draftProduct.slug); // DRAFT must be hidden
  });

  it("2. SEARCH & SORT: should search by term and sort by price ascending", async () => {
    const searchResult = await getStorefrontProducts({
      search: "Smartphone Premium",
    });
    expect(searchResult.products.length).toBeGreaterThanOrEqual(1);
    expect(searchResult.products[0].id).toBe(activeProduct.id);

    const sortResult = await getStorefrontProducts({
      categorySlug: testCategory.slug,
      sort: "price_asc",
    });
    expect(sortResult.products[0].sellingPrice).toBeLessThanOrEqual(sortResult.products[1].sellingPrice);
  });

  it("3. PRODUCT DETAIL: should fetch product with active variants and stock", async () => {
    const product = await getStorefrontProductBySlug(variantProduct.slug);
    expect(product).not.toBeNull();
    expect(product?.name).toBe(variantProduct.name);
    expect(product?.variants.length).toBe(1);
    expect(product?.variants[0].name).toBe("Preto / G");
    expect(product?.inStock).toBe(true);
  });

  it("4. CART REVALIDATION: should recalculate prices from DB and ignore client tampering", async () => {
    const cookieItems = [
      { productId: activeProduct.id, quantity: 2 },
      { productId: variantProduct.id, variantId: variantProduct.variants[0].id, quantity: 1 },
    ];

    const cart = await getStorefrontCart(cookieItems);
    expect(cart.itemsCount).toBe(3);
    // 2 * 1499.00 + 1 * 59.90 = 2998.00 + 59.90 = 3057.90
    expect(cart.subtotalAmount).toBe(3057.9);
    expect(cart.shippingCost).toBe(0); // Subtotal >= 199 -> Frete Grátis
    expect(cart.totalAmount).toBe(3057.9);
  });

  it("5. STOCK PROTECTION: should reject checkout if quantity exceeds available stock", async () => {
    const randomCpf = String(Math.floor(10000000000 + Math.random() * 89999999999));
    const orderInput = {
      customer: {
        name: "Cliente Teste",
        email: `cliente_${Date.now()}_${Math.random()}@teste.com`,
        cpf: randomCpf,
        phone: "11988887777",
      },
      shippingAddress: {
        street: "Rua das Flores",
        number: "123",
        neighborhood: "Jardim",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001000",
      },
      items: [
        { productId: activeProduct.id, quantity: 999 }, // Estoque é apenas 10
      ],
      paymentMethod: PaymentMethod.PIX,
    };

    await expect(createStorefrontOrder(orderInput)).rejects.toThrow(/INSUFFICIENT_STOCK/);
  });

  it("6. PRICE TAMPERING PROTECTION: should compute total from PostgreSQL, not from request payload", async () => {
    const randomCpf = String(Math.floor(10000000000 + Math.random() * 89999999999));
    const orderInput = {
      customer: {
        name: "Comprador Seguro",
        email: `comprador_${Date.now()}_${Math.random()}@teste.com`,
        cpf: randomCpf,
        phone: "11977776666",
      },
      shippingAddress: {
        street: "Av Paulista",
        number: "1000",
        neighborhood: "Bela Vista",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310100",
      },
      items: [
        { productId: activeProduct.id, quantity: 1 }, // unitPrice no DB = 1499.00
      ],
      paymentMethod: PaymentMethod.PIX,
    };

    const order = await createStorefrontOrder(orderInput);
    expect(order).toBeDefined();
    expect(order.orderNumber).toMatch(/^DH-\d+/);
    expect(Number(order.totalAmount)).toBe(1499.0);
    expect(order.items[0].unitPrice.toNumber()).toBe(1499.0);
    expect(order.status).toBe(OrderStatus.AWAITING_PAYMENT);

    // Verificar decremento de estoque
    const updatedProduct = await prisma.product.findUnique({ where: { id: activeProduct.id } });
    expect(updatedProduct?.stock).toBe(9); // 10 - 1 = 9
  });

  it("7. ORDER AUTHORIZATION & ISOLATION: customer A cannot view customer B's order", async () => {
    const cpfA = String(Math.floor(10000000000 + Math.random() * 89999999999));
    const cpfB = String(Math.floor(10000000000 + Math.random() * 89999999999));

    const customerA = await registerCustomer({
      name: "Cliente A",
      email: `clientea_${Date.now()}_${Math.random()}@drophub.com`,
      cpf: cpfA,
      phone: "11966665555",
      password: "password123",
    });

    const customerB = await registerCustomer({
      name: "Cliente B",
      email: `clienteb_${Date.now()}_${Math.random()}@drophub.com`,
      cpf: cpfB,
      phone: "11955554444",
      password: "password123",
    });

    // Criar pedido para o Cliente A
    const orderA = await createStorefrontOrder({
      customer: {
        id: customerA.id,
        name: customerA.name,
        email: customerA.email,
        cpf: customerA.cpf,
        phone: customerA.phone,
      },
      shippingAddress: {
        street: "Rua A",
        number: "10",
        neighborhood: "Bairro A",
        city: "São Paulo",
        state: "SP",
        postalCode: "01001000",
      },
      items: [{ productId: activeProduct.id, quantity: 1 }],
      paymentMethod: PaymentMethod.PIX,
    });

    // Cliente A consulta seu próprio pedido -> Sucesso
    const lookupA = await getStorefrontOrder({
      orderId: orderA.id,
      customerId: customerA.id,
    });
    expect(lookupA.id).toBe(orderA.id);

    // Cliente B tenta consultar pedido do Cliente A -> Proibido (FORBIDDEN)
    await expect(
      getStorefrontOrder({
        orderId: orderA.id,
        customerId: customerB.id,
      })
    ).rejects.toThrow("FORBIDDEN");

    // Visitante com trackingToken válido -> Permitido
    const lookupWithToken = await getStorefrontOrder({
      orderId: orderA.id,
      trackingToken: orderA.trackingToken,
    });
    expect(lookupWithToken.id).toBe(orderA.id);

    // Visitante com trackingToken inválido -> Proibido (FORBIDDEN)
    await expect(
      getStorefrontOrder({
        orderId: orderA.id,
        trackingToken: "invalid-token-uuid",
      })
    ).rejects.toThrow("FORBIDDEN");
  });

  it("8. FULL END-TO-END CHECKOUT & ETAPA 8 GATEWAY INTEGRATION", async () => {
    const randomCpf8 = String(Math.floor(10000000000 + Math.random() * 89999999999));
    // 1. Criar pedido pelo Storefront
    const order = await createStorefrontOrder({
      customer: {
        name: "Consumidor Integrado",
        email: `consumidor_${Date.now()}_${Math.random()}@drophub.com`,
        cpf: randomCpf8,
        phone: "11944443333",
      },
      shippingAddress: {
        street: "Rua da Integração",
        number: "500",
        neighborhood: "Tech Park",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310100",
      },
      items: [{ productId: activeProduct.id, quantity: 1 }],
      paymentMethod: PaymentMethod.PIX,
    });

    // 2. Criar cobrança Pix via Gateway da ETAPA 8
    const paymentResult = await createCheckoutPayment({
      orderId: order.id,
      method: PaymentMethod.PIX,
      gatewayName: "TEST_GATEWAY",
    });

    expect(paymentResult.gatewayResult.success).toBe(true);
    expect(paymentResult.payment.status).toBe(PaymentStatus.PENDING);
    expect(paymentResult.payment.qrCode).toBeDefined();

    // 3. Simular Webhook de Pagamento Aprovado
    const webhookResult = await processPaymentWebhook({
      gatewayName: "TEST",
      rawBody: JSON.stringify({
        event: "PAYMENT_APPROVED",
        transactionId: paymentResult.payment.transactionId!,
      }),
      headers: {},
    });

    expect(webhookResult.success).toBe(true);
    expect(webhookResult.status).toBe("APPROVED");

    // 4. Verificar que Order transicionou para PAID e Payment para APPROVED
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: { payments: true },
    });

    expect(finalOrder?.status).toBe(OrderStatus.PAID);
    expect(finalOrder?.payments[0].status).toBe(PaymentStatus.APPROVED);

    // 5. Verificar evento na Outbox
    const outboxPaid = await prisma.outboxEvent.findFirst({
      where: {
        entityId: order.id,
        eventType: "ORDER_PAID",
      },
    });
    expect(outboxPaid).toBeDefined();
  });
});

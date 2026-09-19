import { prisma } from "@/lib/prisma";
import { ProductStatus, PaymentMethod, PaymentStatus, OrderStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import { decrementStockAtomic } from "@/modules/stock";

export interface StorefrontProductFilter {
  categorySlug?: string;
  search?: string;
  minPrice?: number;
  maxPrice?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "name_asc";
  page?: number;
  limit?: number;
}

export interface CartCookieItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
}

/**
 * Retorna os dados principais da vitrine / Home da loja
 */
export async function getStorefrontHome() {
  const [categories, featuredProducts, recentProducts] = await Promise.all([
    // Categorias ativas com contagem de produtos
    prisma.category.findMany({
      where: { active: true },
      take: 6,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: { where: { status: ProductStatus.ACTIVE, active: true } } },
        },
      },
    }),
    // Produtos em destaque (ativos)
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, active: true },
      take: 8,
      orderBy: { createdAt: "desc" },
      include: {
        images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { active: true } },
      },
    }),
    // Lançamentos recentes
    prisma.product.findMany({
      where: { status: ProductStatus.ACTIVE, active: true },
      take: 4,
      orderBy: { updatedAt: "desc" },
      include: {
        images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
        category: { select: { id: true, name: true, slug: true } },
      },
    }),
  ]);

  return {
    categories: categories.map((c) => ({
      id: c.id,
      name: c.name,
      slug: c.slug,
      description: c.description,
      productsCount: c._count.products,
    })),
    featuredProducts: featuredProducts.map(formatProductSummary),
    recentProducts: recentProducts.map(formatProductSummary),
  };
}

/**
 * Consulta catálogo público de produtos com filtros e paginação
 */
export async function getStorefrontProducts(filters: StorefrontProductFilter) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 12));
  const skip = (page - 1) * limit;

  const where: any = {
    status: ProductStatus.ACTIVE,
    active: true,
  };

  if (filters.categorySlug) {
    where.category = { slug: filters.categorySlug, active: true };
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { description: { contains: q, mode: "insensitive" } },
      { shortDescription: { contains: q, mode: "insensitive" } },
    ];
  }

  if (filters.minPrice !== undefined || filters.maxPrice !== undefined) {
    where.sellingPrice = {};
    if (filters.minPrice !== undefined) where.sellingPrice.gte = new Decimal(filters.minPrice);
    if (filters.maxPrice !== undefined) where.sellingPrice.lte = new Decimal(filters.maxPrice);
  }

  let orderBy: any = { createdAt: "desc" };
  if (filters.sort === "price_asc") orderBy = { sellingPrice: "asc" };
  else if (filters.sort === "price_desc") orderBy = { sellingPrice: "desc" };
  else if (filters.sort === "name_asc") orderBy = { name: "asc" };

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
        category: { select: { id: true, name: true, slug: true } },
        variants: { where: { active: true } },
      },
    }),
  ]);

  return {
    products: products.map(formatProductSummary),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Consulta detalhe de um produto por slug
 */
export async function getStorefrontProductBySlug(slug: string) {
  const product = await prisma.product.findFirst({
    where: {
      slug,
      status: ProductStatus.ACTIVE,
      active: true,
    },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
      category: { select: { id: true, name: true, slug: true } },
      variants: {
        where: { active: true },
        orderBy: { name: "asc" },
      },
    },
  });

  if (!product) return null;

  return {
    id: product.id,
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    description: product.description,
    shortDescription: product.shortDescription,
    sellingPrice: Number(product.sellingPrice),
    stock: product.stock,
    inStock: product.stock > 0,
    category: product.category,
    images: product.images.map((img) => ({
      id: img.id,
      url: img.url,
      altText: img.altText || product.name,
      isCover: img.isCover,
    })),
    variants: product.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      attributes: v.attributesJson,
      sellingPrice: Number(v.sellingPrice),
      stock: v.stock,
      inStock: v.stock > 0,
    })),
  };
}

/**
 * Consulta lista de categorias ativas
 */
export async function getStorefrontCategories() {
  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { products: { where: { status: ProductStatus.ACTIVE, active: true } } },
      },
    },
  });

  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    productsCount: c._count.products,
  }));
}

/**
 * Revalida o carrinho a partir do PostgreSQL (ignora preços do browser)
 */
export async function getStorefrontCart(cookieItems: CartCookieItem[]) {
  if (!cookieItems || cookieItems.length === 0) {
    return {
      items: [],
      itemsCount: 0,
      subtotalAmount: 0,
      shippingCost: 0,
      totalAmount: 0,
    };
  }

  const productIds = cookieItems.map((it) => it.productId);
  const dbProducts = await prisma.product.findMany({
    where: {
      id: { in: productIds },
      status: ProductStatus.ACTIVE,
      active: true,
    },
    include: {
      images: { orderBy: [{ isCover: "desc" }, { position: "asc" }] },
      variants: { where: { active: true } },
    },
  });

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));
  let subtotal = 0;
  let totalItemsCount = 0;

  const validItems: any[] = [];

  for (const item of cookieItems) {
    const product = productMap.get(item.productId);
    if (!product) continue;

    let unitPrice = Number(product.sellingPrice);
    let variantInfo: any = null;
    let availableStock = product.stock;

    if (item.variantId) {
      const variant = product.variants.find((v) => v.id === item.variantId);
      if (variant) {
        variantInfo = {
          id: variant.id,
          name: variant.name,
          sku: variant.sku,
        };
        unitPrice = Number(variant.sellingPrice);
        availableStock = variant.stock;
      }
    }

    const quantity = Math.min(item.quantity, Math.max(1, availableStock));
    const totalPrice = Number((unitPrice * quantity).toFixed(2));

    subtotal += totalPrice;
    totalItemsCount += quantity;

    validItems.push({
      productId: product.id,
      variantId: item.variantId || null,
      name: product.name,
      slug: product.slug,
      sku: variantInfo?.sku || product.sku,
      image: product.images[0]?.url || "",
      variant: variantInfo,
      unitPrice,
      quantity,
      totalPrice,
      availableStock,
    });
  }

  const subtotalAmount = Number(subtotal.toFixed(2));
  // Política de frete: Frete Grátis para compras a partir de R$ 199,00; caso contrário R$ 15,00
  const shippingCost = subtotalAmount >= 199 || subtotalAmount === 0 ? 0 : 15.0;
  const totalAmount = Number((subtotalAmount + shippingCost).toFixed(2));

  return {
    items: validItems,
    itemsCount: totalItemsCount,
    subtotalAmount,
    shippingCost,
    totalAmount,
  };
}

/**
 * Criação atômica de pedido público (Storefront Checkout) com recálculo seguro no PostgreSQL
 */
export async function createStorefrontOrder(input: {
  customer: {
    id?: string;
    name: string;
    email: string;
    cpf: string;
    phone: string;
  };
  shippingAddress: {
    street: string;
    number: string;
    complement?: string | null;
    neighborhood: string;
    city: string;
    state: string;
    postalCode: string;
  };
  items: Array<{
    productId: string;
    variantId?: string | null;
    quantity: number;
  }>;
  paymentMethod: PaymentMethod;
  notes?: string | null;
}) {
  const normalizedEmail = input.customer.email.toLowerCase().trim();
  const cleanCpf = input.customer.cpf.replace(/\D/g, "");

  return await prisma.$transaction(async (tx) => {
    // 1. Identificar ou Criar Customer
    let customerId = input.customer.id;
    let customer = null;

    if (customerId) {
      customer = await tx.customer.findUnique({ where: { id: customerId } });
    }

    if (!customer) {
      customer = await tx.customer.findUnique({ where: { email: normalizedEmail } });
    }

    if (!customer) {
      customer = await tx.customer.findUnique({ where: { cpf: cleanCpf } });
    }

    if (!customer) {
      customer = await tx.customer.create({
        data: {
          name: input.customer.name.trim(),
          email: normalizedEmail,
          cpf: cleanCpf,
          phone: input.customer.phone.trim(),
        },
      });
    }

    customerId = customer.id;

    // 2. Persistir Endereço no histórico do cliente se não existir
    const existingAddress = await tx.customerAddress.findFirst({
      where: {
        customerId,
        postalCode: input.shippingAddress.postalCode.replace(/\D/g, ""),
        number: input.shippingAddress.number,
      },
    });

    if (!existingAddress) {
      await tx.customerAddress.create({
        data: {
          customerId,
          street: input.shippingAddress.street.trim(),
          number: input.shippingAddress.number.trim(),
          complement: input.shippingAddress.complement?.trim() || null,
          neighborhood: input.shippingAddress.neighborhood.trim(),
          city: input.shippingAddress.city.trim(),
          state: input.shippingAddress.state.trim().toUpperCase(),
          postalCode: input.shippingAddress.postalCode.replace(/\D/g, ""),
          isDefault: true,
        },
      });
    }

    // 3. Revalidar Produtos e Capturar Snapshot Comercial Oficial
    const productIds = input.items.map((i) => i.productId);
    const dbProducts = await tx.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
        active: true,
      },
      include: {
        variants: { where: { active: true } },
      },
    });

    if (dbProducts.length !== productIds.length) {
      throw new Error("SOME_PRODUCTS_UNAVAILABLE");
    }

    const productMap = new Map(dbProducts.map((p) => [p.id, p]));
    let subtotal = 0;
    let totalCost = 0;

    const orderItemsSnapshot: any[] = [];

    for (const item of input.items) {
      const p = productMap.get(item.productId)!;

      let unitCost = Number(p.costPrice);
      let unitPrice = Number(p.sellingPrice);
      let availableStock = p.stock;
      let sku = p.sku;
      let itemName = p.name;

      if (item.variantId) {
        const variant = p.variants.find((v) => v.id === item.variantId);
        if (!variant) {
          throw new Error(`VARIANT_NOT_FOUND_${p.name}`);
        }
        unitCost = Number(variant.costPrice);
        unitPrice = Number(variant.sellingPrice);
        availableStock = variant.stock;
        sku = variant.sku;
        itemName = `${p.name} (${variant.name})`;
      }

      if (availableStock < item.quantity) {
        throw new Error(`INSUFFICIENT_STOCK_${p.name}`);
      }

      const itemTotalPrice = Number((unitPrice * item.quantity).toFixed(2));
      const itemTotalCost = Number((unitCost * item.quantity).toFixed(2));
      const itemProfit = Number((itemTotalPrice - itemTotalCost).toFixed(2));

      subtotal += itemTotalPrice;
      totalCost += itemTotalCost;

      orderItemsSnapshot.push({
        productId: p.id,
        variantId: item.variantId || null,
        sku,
        name: itemName,
        unitCost: new Decimal(unitCost),
        unitPrice: new Decimal(unitPrice),
        quantity: item.quantity,
        totalCost: new Decimal(itemTotalCost),
        totalPrice: new Decimal(itemTotalPrice),
        profit: new Decimal(itemProfit),
      });
    }

    // 4. Cálculos Financeiros
    const finalSubtotal = Number(subtotal.toFixed(2));
    const finalShipping = finalSubtotal >= 199 || finalSubtotal === 0 ? 0 : 15.0;
    const finalDiscount = 0.0;
    const finalTotal = Number((finalSubtotal + finalShipping - finalDiscount).toFixed(2));
    const finalTotalCost = Number(totalCost.toFixed(2));
    const finalProfit = Number((finalTotal - finalTotalCost).toFixed(2));

    const marginPercentage =
      finalTotal > 0 ? Number(((finalProfit / finalTotal) * 100).toFixed(2)) : 0;
    const markupPercentage =
      finalTotalCost > 0 ? Number(((finalProfit / finalTotalCost) * 100).toFixed(2)) : 0;

    // 5. Gerar Número Sequencial Único do Pedido
    const orderCount = await tx.order.count();
    const uniqueSuffix = Math.floor(100 + Math.random() * 900);
    const orderNumber = `DH-${1000 + orderCount + 1}${uniqueSuffix}`;

    // 6. Criar Registro do Pedido
    const order = await tx.order.create({
      data: {
        orderNumber,
        customerId,
        status: OrderStatus.AWAITING_PAYMENT,
        subtotalAmount: new Decimal(finalSubtotal),
        shippingCost: new Decimal(finalShipping),
        discountAmount: new Decimal(finalDiscount),
        totalAmount: new Decimal(finalTotal),
        totalCostAmount: new Decimal(finalTotalCost),
        estimatedProfit: new Decimal(finalProfit),
        marginPercentage: new Decimal(marginPercentage),
        markupPercentage: new Decimal(markupPercentage),
        shippingAddress: input.shippingAddress,
        notes: input.notes || null,
        items: {
          create: orderItemsSnapshot,
        },
        statusHistory: {
          create: {
            previousStatus: OrderStatus.AWAITING_PAYMENT,
            newStatus: OrderStatus.AWAITING_PAYMENT,
            reason: "Pedido criado através da Loja Pública / Storefront.",
          },
        },
      },
      include: {
        items: true,
        customer: true,
        payments: true,
      },
    });

    // 7. Decrementar estoque atomicamente via PostgreSQL com StockMovement ledger e outbox alerts
    await decrementStockAtomic(tx, {
      items: order.items.map((oi) => ({
        productId: oi.productId,
        variantId: oi.variantId,
        quantity: oi.quantity,
        orderItemId: oi.id,
        unitPrice: Number(oi.unitPrice),
        name: oi.name,
      })),
      orderId: order.id,
      type: "SALE",
      reason: `Venda na Loja Pública (Pedido ${order.orderNumber})`,
    });

    // 8. Publicar Evento de Domínio na Outbox
    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.ORDER_CREATED,
      entityType: "Order",
      entityId: order.id,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        customerId: order.customerId,
        customerName: customer.name,
        customerEmail: customer.email,
        itemsCount: order.items.length,
      },
    });

    return order;
  });
}

/**
 * Consulta pedido com proteção estrita de autorização (Cliente autenticado OU Tracking Token)
 */
export async function getStorefrontOrder(params: {
  orderId: string;
  customerId?: string | null;
  trackingToken?: string | null;
}) {
  const order = await prisma.order.findUnique({
    where: { id: params.orderId },
    include: {
      items: {
        include: {
          product: {
            select: {
              slug: true,
              images: { take: 1, orderBy: [{ isCover: "desc" }, { position: "asc" }] },
            },
          },
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
      },
      statusHistory: {
        orderBy: { createdAt: "asc" },
      },
      customer: {
        select: { id: true, name: true, email: true, phone: true },
      },
      shipments: {
        include: {
          trackings: {
            orderBy: { timestamp: "desc" },
          },
        },
      },
      fulfillmentOrders: {
        select: {
          id: true,
          status: true,
          supplierId: true,
          supplier: { select: { name: true } },
          shippedAt: true,
          deliveredAt: true,
        },
      },
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  // Validação estrita de autorização
  const isOwner = params.customerId && order.customerId === params.customerId;
  const hasValidToken = params.trackingToken && order.trackingToken === params.trackingToken;

  if (!isOwner && !hasValidToken) {
    throw new Error("FORBIDDEN");
  }

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    trackingToken: order.trackingToken,
    status: order.status,
    subtotalAmount: Number(order.subtotalAmount),
    shippingCost: Number(order.shippingCost),
    discountAmount: Number(order.discountAmount),
    totalAmount: Number(order.totalAmount),
    shippingAddress: order.shippingAddress,
    customer: order.customer,
    createdAt: order.createdAt,
    items: order.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      variantId: it.variantId,
      sku: it.sku,
      name: it.name,
      unitPrice: Number(it.unitPrice),
      quantity: it.quantity,
      totalPrice: Number(it.totalPrice),
      slug: it.product?.slug || "",
      image: it.product?.images[0]?.url || "",
    })),
    payments: order.payments.map((p) => ({
      id: p.id,
      gateway: p.gateway,
      method: p.method,
      status: p.status,
      amount: Number(p.amount),
      qrCode: p.qrCode,
      qrCodeBase64: p.qrCodeBase64,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    })),
    shipments: order.shipments.map((s) => ({
      id: s.id,
      carrier: s.carrier || "Correios",
      trackingNumber: s.trackingNumber,
      trackingUrl: s.trackingUrl,
      status: s.status,
      shippedAt: s.shippedAt,
      deliveredAt: s.deliveredAt,
      trackings: s.trackings.map((t) => ({
        id: t.id,
        status: t.status,
        description: t.description,
        location: t.location,
        timestamp: t.timestamp,
      })),
    })),
    fulfillments: order.fulfillmentOrders.map((f) => ({
      id: f.id,
      status: f.status,
      supplierName: f.supplier?.name || "Fornecedor Parceiro",
      shippedAt: f.shippedAt,
      deliveredAt: f.deliveredAt,
    })),
    timeline: order.statusHistory.map((h) => ({
      id: h.id,
      previousStatus: h.previousStatus,
      newStatus: h.newStatus,
      reason: h.reason,
      createdAt: h.createdAt,
    })),
  };
}

/**
 * Consulta pedidos de um cliente autenticado
 */
export async function listCustomerOrders(customerId: string, page = 1, limit = 10) {
  const skip = (page - 1) * limit;

  const [total, orders] = await Promise.all([
    prisma.order.count({ where: { customerId } }),
    prisma.order.findMany({
      where: { customerId },
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        items: true,
        payments: {
          select: { id: true, method: true, status: true, amount: true },
        },
      },
    }),
  ]);

  return {
    orders: orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      trackingToken: o.trackingToken,
      status: o.status,
      totalAmount: Number(o.totalAmount),
      itemsCount: o.items.reduce((acc, it) => acc + it.quantity, 0),
      createdAt: o.createdAt,
      payments: o.payments,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

function formatProductSummary(p: any) {
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku,
    shortDescription: p.shortDescription,
    sellingPrice: Number(p.sellingPrice),
    stock: p.stock,
    inStock: p.stock > 0,
    coverImage: p.images?.[0]?.url || "",
    category: p.category ? { id: p.category.id, name: p.category.name, slug: p.category.slug } : null,
    variantsCount: p.variants?.length || 0,
  };
}

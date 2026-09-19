import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CreateOrderSchema } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";
import { OrderStatus, PaymentMethod, PaymentStatus } from "@prisma/client";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import { decrementStockAtomic } from "@/modules/stock";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const status = searchParams.get("status") as OrderStatus | null;
    const customerId = searchParams.get("customerId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { orderNumber: { contains: q, mode: "insensitive" } },
        { customer: { name: { contains: q, mode: "insensitive" } } },
        { customer: { email: { contains: q, mode: "insensitive" } } },
      ];
    }

    if (status) where.status = status;
    if (customerId) where.customerId = customerId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const [total, orders] = await Promise.all([
      prisma.order.count({ where }),
      prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          customer: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: true,
          payments: {
            select: { id: true, gateway: true, method: true, status: true, amount: true },
          },
          shipments: {
            select: { id: true, carrier: true, trackingNumber: true, status: true },
          },
        },
      }),
    ]);

    const formattedOrders = orders.map((o) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      customer: o.customer,
      status: o.status,
      subtotalAmount: Number(o.subtotalAmount),
      shippingCost: Number(o.shippingCost),
      discountAmount: Number(o.discountAmount),
      totalAmount: Number(o.totalAmount),
      totalCostAmount: Number(o.totalCostAmount),
      estimatedProfit: Number(o.estimatedProfit),
      marginPercentage: Number(o.marginPercentage),
      markupPercentage: Number(o.markupPercentage),
      itemsCount: o.items.reduce((sum, it) => sum + it.quantity, 0),
      items: o.items.map((it) => ({
        id: it.id,
        productId: it.productId,
        sku: it.sku,
        name: it.name,
        unitPrice: Number(it.unitPrice),
        unitCost: Number(it.unitCost),
        quantity: it.quantity,
        totalPrice: Number(it.totalPrice),
      })),
      payments: o.payments,
      shipments: o.shipments,
      createdAt: o.createdAt,
      updatedAt: o.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedOrders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ORDERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar pedidos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await req.json();
    const parseResult = CreateOrderSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do pedido inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      customerId,
      items,
      shippingCost,
      discountAmount,
      shippingAddress,
      initialStatus,
      paymentMethod,
      notes,
    } = parseResult.data;

    // 1. Executa a criação atômica via Prisma Transaction
    const newOrder = await prisma.$transaction(async (tx) => {
      // 1.1 Validar Cliente
      const customer = await tx.customer.findUnique({ where: { id: customerId } });
      if (!customer) {
        throw new Error("CLIENT_NOT_FOUND");
      }

      // 1.2 Validar Produtos e capturar Snapshot comercial
      const productIds = items.map((i) => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
      });

      if (dbProducts.length !== productIds.length) {
        throw new Error("SOME_PRODUCTS_NOT_FOUND");
      }

      // Mapear produtos por ID
      const productMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotal = 0;
      let totalCost = 0;

      const orderItemsSnapshot = items.map((item) => {
        const p = productMap.get(item.productId)!;

        // Verificar estoque suficiente
        if (p.stock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK_${p.name}`);
        }

        const unitCost = Number(p.costPrice);
        const unitPrice = Number(p.sellingPrice);
        const itemTotalPrice = Number((unitPrice * item.quantity).toFixed(2));
        const itemTotalCost = Number((unitCost * item.quantity).toFixed(2));
        const itemProfit = Number((itemTotalPrice - itemTotalCost).toFixed(2));

        subtotal += itemTotalPrice;
        totalCost += itemTotalCost;

        return {
          productId: p.id,
          variantId: item.variantId || null,
          sku: p.sku, // Snapshot imutável do SKU
          name: p.name, // Snapshot imutável do Nome
          unitCost: new Decimal(unitCost),
          unitPrice: new Decimal(unitPrice),
          quantity: item.quantity,
          totalCost: new Decimal(itemTotalCost),
          totalPrice: new Decimal(itemTotalPrice),
          profit: new Decimal(itemProfit),
        };
      });

      // 1.3 Cálculos Financeiros Consolidados
      const finalSubtotal = Number(subtotal.toFixed(2));
      const finalShipping = Number(shippingCost.toFixed(2));
      const finalDiscount = Number(discountAmount.toFixed(2));
      const finalTotal = Number((finalSubtotal + finalShipping - finalDiscount).toFixed(2));
      const finalTotalCost = Number(totalCost.toFixed(2));
      const finalProfit = Number((finalTotal - finalTotalCost).toFixed(2));

      const marginPercentage =
        finalTotal > 0 ? Number(((finalProfit / finalTotal) * 100).toFixed(2)) : 0;
      const markupPercentage =
        finalTotalCost > 0 ? Number(((finalProfit / finalTotalCost) * 100).toFixed(2)) : 0;

      // 1.4 Gerar Número Sequencial do Pedido
      const orderCount = await tx.order.count();
      const orderNumber = `DH-${1000 + orderCount + 1}`;

      // 1.5 Criar Pedido com OrderItems Snapshot
      const order = await tx.order.create({
        data: {
          orderNumber,
          customerId,
          status: initialStatus as OrderStatus,
          subtotalAmount: new Decimal(finalSubtotal),
          shippingCost: new Decimal(finalShipping),
          discountAmount: new Decimal(finalDiscount),
          totalAmount: new Decimal(finalTotal),
          totalCostAmount: new Decimal(finalTotalCost),
          estimatedProfit: new Decimal(finalProfit),
          marginPercentage: new Decimal(marginPercentage),
          markupPercentage: new Decimal(markupPercentage),
          shippingAddress,
          notes: notes || null,
          items: {
            create: orderItemsSnapshot,
          },
          payments: {
            create: {
              gateway: "TEST_GATEWAY",
              method: paymentMethod as PaymentMethod,
              status:
                initialStatus === "PAID" ? PaymentStatus.APPROVED : PaymentStatus.PENDING,
              amount: new Decimal(finalTotal),
              paidAt: initialStatus === "PAID" ? new Date() : null,
              transactionId: `TX-ADM-${orderNumber}`,
            },
          },
          statusHistory: {
            create: {
              previousStatus: OrderStatus.AWAITING_PAYMENT,
              newStatus: initialStatus as OrderStatus,
              reason: "Criação do pedido pelo painel administrativo.",
              changedByUserId: user.id,
            },
          },
        },
        include: {
          items: true,
          payments: true,
          statusHistory: true,
          customer: true,
        },
      });

      // 1.6 Decrementar estoque atomicamente via PostgreSQL com StockMovement ledger e outbox alerts
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
        reason: `Pedido criado via Painel Administrativo (${order.orderNumber})`,
        userId: user.id,
      });

      // 1.5 Registrar Evento de Domínio na Outbox
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
          customerName: order.customer?.name || customer.name,
          customerEmail: order.customer?.email || customer.email,
          itemsCount: order.items.length,
        },
      });

      if (order.status === OrderStatus.PAID) {
        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.ORDER_PAID,
          entityType: "Order",
          entityId: order.id,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            totalAmount: Number(order.totalAmount),
          },
        });

        const approvedPayment = order.payments.find((p) => p.status === PaymentStatus.APPROVED);
        if (approvedPayment) {
          await publishDomainEvent(tx, {
            type: DOMAIN_EVENTS.PAYMENT_APPROVED,
            entityType: "Payment",
            entityId: approvedPayment.id,
            data: {
              paymentId: approvedPayment.id,
              orderId: order.id,
              orderNumber: order.orderNumber,
              gateway: approvedPayment.gateway,
              method: approvedPayment.method,
              amount: Number(approvedPayment.amount),
              transactionId: approvedPayment.transactionId,
            },
          });
        }
      }

      return order;
    });

    return NextResponse.json({ success: true, order: newOrder, data: newOrder }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "CLIENT_NOT_FOUND") {
      return NextResponse.json({ error: "Cliente informado não foi encontrado." }, { status: 400 });
    }
    if (error.message?.startsWith("INSUFFICIENT_STOCK_")) {
      const prodName = error.message.replace("INSUFFICIENT_STOCK_", "");
      return NextResponse.json(
        { error: `Estoque insuficiente para o produto: ${prodName}` },
        { status: 400 }
      );
    }
    console.error("[API_ORDERS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar pedido." }, { status: 500 });
  }
}

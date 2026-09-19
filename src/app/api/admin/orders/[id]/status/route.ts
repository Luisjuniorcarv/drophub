import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { UpdateOrderStatusSchema } from "@/lib/validators";
import { isValidStatusTransition } from "@/modules/orders/state-machine";
import { OrderStatus, PaymentStatus } from "@prisma/client";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import { incrementStockAtomic } from "@/modules/stock";

interface Params {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: Params) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = UpdateOrderStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Status de pedido inválido.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { status: newStatus, reason } = parseResult.data;

    // Validar máquina de estados
    const isTransitionAllowed = isValidStatusTransition(order.status, newStatus as OrderStatus);
    if (!isTransitionAllowed) {
      return NextResponse.json(
        {
          error: `Transição de status inválida: não é permitido alterar de ${order.status} para ${newStatus}.`,
        },
        { status: 400 }
      );
    }

    // Executar atualização e auditoria em transação
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // 1. Se estiver cancelando um pedido antes do envio, devolve o estoque de forma atômica e idempotente
      if (
        newStatus === OrderStatus.CANCELLED &&
        ([OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID, OrderStatus.PROCESSING] as OrderStatus[]).includes(order.status)
      ) {
        await incrementStockAtomic(tx, {
          items: order.items.map((it) => ({
            productId: it.productId,
            variantId: it.variantId,
            quantity: it.quantity,
            orderItemId: it.id,
          })),
          orderId: order.id,
          type: "CANCEL",
          reason: reason || `Cancelamento do Pedido ${order.orderNumber}`,
          userId: user.id,
        });
      }

      // 2. Se mudou para PAID, atualiza o pagamento pendente para APPROVED
      if (newStatus === OrderStatus.PAID) {
        const pendingPayment = order.payments.find((p) => p.status === PaymentStatus.PENDING);
        if (pendingPayment) {
          await tx.payment.update({
            where: { id: pendingPayment.id },
            data: {
              status: PaymentStatus.APPROVED,
              paidAt: new Date(),
            },
          });
        }
      }

      // 3. Se mudou para REFUNDED, atualiza pagamento para REFUNDED
      if (newStatus === OrderStatus.REFUNDED) {
        const approvedPayment = order.payments.find((p) => p.status === PaymentStatus.APPROVED);
        if (approvedPayment) {
          await tx.payment.update({
            where: { id: approvedPayment.id },
            data: {
              status: PaymentStatus.REFUNDED,
            },
          });
        }
      }

      // 4. Grava auditoria imutável (append-only) em OrderStatusHistory
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          previousStatus: order.status,
          newStatus: newStatus as OrderStatus,
          reason: reason || `Status atualizado para ${newStatus} pelo usuário ${user.name}.`,
          changedByUserId: user.id,
        },
      });

      // 5. Atualiza o status do pedido
      const updated = await tx.order.update({
        where: { id },
        data: { status: newStatus as OrderStatus },
        include: {
          items: true,
          payments: true,
          customer: true,
          statusHistory: {
            orderBy: { createdAt: "asc" },
            include: { changedByUser: { select: { name: true, email: true } } },
          },
        },
      });

      // 6. Publica evento de domínio correspondente na Outbox
      const eventTypeMap: Record<string, string> = {
        [OrderStatus.PAID]: DOMAIN_EVENTS.ORDER_PAID,
        [OrderStatus.PROCESSING]: DOMAIN_EVENTS.ORDER_PROCESSING,
        [OrderStatus.AWAITING_SUPPLIER]: DOMAIN_EVENTS.ORDER_AWAITING_SUPPLIER,
        [OrderStatus.SENT_TO_SUPPLIER]: DOMAIN_EVENTS.ORDER_SENT_TO_SUPPLIER,
        [OrderStatus.SHIPPED]: DOMAIN_EVENTS.ORDER_SHIPPED,
        [OrderStatus.DELIVERED]: DOMAIN_EVENTS.ORDER_DELIVERED,
        [OrderStatus.CANCELLED]: DOMAIN_EVENTS.ORDER_CANCELLED,
        [OrderStatus.REFUNDED]: DOMAIN_EVENTS.ORDER_REFUNDED,
      };

      const eventType = eventTypeMap[newStatus];
      if (eventType) {
        await publishDomainEvent(tx, {
          type: eventType,
          entityType: "Order",
          entityId: updated.id,
          data: {
            orderId: updated.id,
            orderNumber: updated.orderNumber,
            previousStatus: order.status,
            newStatus: updated.status,
            totalAmount: Number(updated.totalAmount),
            customerId: updated.customerId,
            customerName: updated.customer?.name,
            customerEmail: updated.customer?.email,
            reason: reason || null,
          },
        });
      }

      if (newStatus === OrderStatus.PAID) {
        const approvedPayment = updated.payments.find((p) => p.status === PaymentStatus.APPROVED);
        if (approvedPayment) {
          await publishDomainEvent(tx, {
            type: DOMAIN_EVENTS.PAYMENT_APPROVED,
            entityType: "Payment",
            entityId: approvedPayment.id,
            data: {
              paymentId: approvedPayment.id,
              orderId: updated.id,
              orderNumber: updated.orderNumber,
              gateway: approvedPayment.gateway,
              method: approvedPayment.method,
              amount: Number(approvedPayment.amount),
              transactionId: approvedPayment.transactionId,
            },
          });
        }
      }

      return updated;
    });

    return NextResponse.json({ success: true, order: updatedOrder, data: updatedOrder });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ORDER_STATUS_PATCH_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar status do pedido." }, { status: 500 });
  }
}

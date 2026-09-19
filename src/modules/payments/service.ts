import { prisma } from "@/lib/prisma";
import { getPaymentGateway } from "./gateway-factory";
import {
  CreatePaymentInput,
  CreatePaymentOutput,
  PAYMENT_GATEWAYS,
} from "./types";
import { PaymentMethod, PaymentStatus, OrderStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";


export interface CheckoutPaymentParams {
  orderId: string;
  method: PaymentMethod;
  gatewayName?: string;
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string;
  issuerId?: string;
  idempotencyKey?: string;
  payer?: {
    name?: string;
    email?: string;
    cpf?: string;
    phone?: string;
  };
}

/**
 * Cria ou recupera uma cobrança de pagamento para um pedido de forma idempotente.
 */
export async function createCheckoutPayment(params: CheckoutPaymentParams): Promise<{
  payment: any;
  gatewayResult: CreatePaymentOutput;
}> {
  const { orderId, method, gatewayName, cardToken, installments, paymentMethodId, issuerId, idempotencyKey, payer } =
    params;

  // 1. Buscar Pedido e Cliente
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      payments: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  // 2. Validações de Estado do Pedido
  if (order.status === OrderStatus.CANCELLED) {
    throw new Error("ORDER_CANCELLED");
  }

  if (order.status === OrderStatus.REFUNDED) {
    throw new Error("ORDER_REFUNDED");
  }

  // Se já existe pagamento aprovado
  const existingApproved = order.payments.find((p) => p.status === PaymentStatus.APPROVED);
  if (existingApproved || order.status === OrderStatus.PAID) {
    throw new Error("ORDER_ALREADY_PAID");
  }

  // 3. Idempotência de Pix: Se já existe um Pix pendente válido e não expirado, reutilizá-lo
  if (method === PaymentMethod.PIX) {
    const existingPendingPix = order.payments.find(
      (p) =>
        p.method === PaymentMethod.PIX &&
        p.status === PaymentStatus.PENDING &&
        p.qrCode &&
        (!p.expiresAt || new Date(p.expiresAt) > new Date())
    );

    if (existingPendingPix) {
      return {
        payment: existingPendingPix,
        gatewayResult: {
          success: true,
          gateway: existingPendingPix.gateway,
          transactionId: existingPendingPix.transactionId || "",
          status: PaymentStatus.PENDING,
          amount: Number(existingPendingPix.amount),
          qrCode: existingPendingPix.qrCode,
          qrCodeBase64: existingPendingPix.qrCodeBase64,
          expiresAt: existingPendingPix.expiresAt,
        },
      };
    }
  }

  // 4. Instanciar Gateway Selecionado
  const gateway = getPaymentGateway(gatewayName);

  const payerName = payer?.name || order.customer.name;
  const payerEmail = payer?.email || order.customer.email;
  const payerCpf = payer?.cpf || order.customer.cpf;
  const payerPhone = payer?.phone || order.customer.phone;

  const paymentInput: CreatePaymentInput = {
    orderId: order.id,
    orderNumber: order.orderNumber,
    amount: order.totalAmount, // Derivado estritamente do banco
    method,
    payer: {
      name: payerName,
      email: payerEmail,
      cpf: payerCpf,
      phone: payerPhone,
    },
    idempotencyKey:
      idempotencyKey ||
      (method === PaymentMethod.PIX
        ? `drophub_${order.id}_pix`
        : `drophub_${order.id}_${method}_${Date.now()}`),
    cardToken,
    installments,
    paymentMethodId,
    issuerId,
  };

  // 5. Executar cobrança no gateway
  const gatewayResult = await gateway.createPayment(paymentInput);

  // 6. Persistir resultado atomicamente via Prisma $transaction com tratamento de concorrência
  try {
    const savedPayment = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          orderId: order.id,
          gateway: gateway.name,
          method,
          status: gatewayResult.status,
          transactionId: gatewayResult.transactionId || null,
          idempotencyKey: paymentInput.idempotencyKey || null,
          amount: order.totalAmount,
          qrCode: gatewayResult.qrCode || null,
          qrCodeBase64: gatewayResult.qrCodeBase64 || null,
          expiresAt: gatewayResult.expiresAt || null,
          paidAt: gatewayResult.status === PaymentStatus.APPROVED ? new Date() : null,
          failedAt: gatewayResult.status === PaymentStatus.FAILED ? new Date() : null,
          failureReason: gatewayResult.failureReason || null,
          gatewayResponse: gatewayResult.rawResponse || undefined,
        },
      });

      // Se o gateway aprovou imediatamente (ex: Cartão de crédito)
      if (gatewayResult.status === PaymentStatus.APPROVED) {
        await tx.order.update({
          where: { id: order.id },
          data: { status: OrderStatus.PAID },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: order.id,
            previousStatus: order.status,
            newStatus: OrderStatus.PAID,
            reason: `Pagamento aprovado via gateway ${gateway.name} (Tx: ${payment.transactionId}).`,
          },
        });

        // Publicar eventos de domínio
        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.PAYMENT_APPROVED,
          entityType: "Payment",
          entityId: payment.id,
          data: {
            paymentId: payment.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            gateway: gateway.name,
            method,
            amount: Number(payment.amount),
            transactionId: payment.transactionId,
          },
        });

        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.ORDER_PAID,
          entityType: "Order",
          entityId: order.id,
          data: {
            orderId: order.id,
            orderNumber: order.orderNumber,
            status: OrderStatus.PAID,
            totalAmount: Number(order.totalAmount),
            customerId: order.customerId,
            customerName: order.customer.name,
            customerEmail: order.customer.email,
          },
        });
      }

      // Se o pagamento falhou
      if (gatewayResult.status === PaymentStatus.FAILED) {
        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.PAYMENT_FAILED,
          entityType: "Payment",
          entityId: payment.id,
          data: {
            paymentId: payment.id,
            orderId: order.id,
            orderNumber: order.orderNumber,
            gateway: gateway.name,
            method,
            amount: Number(payment.amount),
            failureReason: gatewayResult.failureReason,
          },
        });
      }

      return payment;
    });

    return {
      payment: savedPayment,
      gatewayResult,
    };
  } catch (error: any) {
    // Tratar colisão de chave de idempotência concorrente (P2002 Unique Constraint Violation)
    if (
      (error.code === "P2002" || error.message?.includes("Unique constraint")) &&
      paymentInput.idempotencyKey
    ) {
      const existingPayment = await prisma.payment.findUnique({
        where: { idempotencyKey: paymentInput.idempotencyKey },
      });

      if (existingPayment) {
        return {
          payment: existingPayment,
          gatewayResult: {
            success:
              existingPayment.status === PaymentStatus.APPROVED ||
              existingPayment.status === PaymentStatus.PENDING,
            gateway: existingPayment.gateway,
            transactionId: existingPayment.transactionId || "",
            status: existingPayment.status,
            amount: Number(existingPayment.amount),
            qrCode: existingPayment.qrCode,
            qrCodeBase64: existingPayment.qrCodeBase64,
            expiresAt: existingPayment.expiresAt,
          },
        };
      }
    }
    throw error;
  }
}

/**
 * Processador de Webhook de Pagamento com Verificação de Assinatura e Idempotência
 */
export async function processPaymentWebhook(params: {
  gatewayName: string;
  rawBody: string;
  headers: Record<string, string>;
}): Promise<{ success: boolean; action: string; transactionId: string; status?: PaymentStatus }> {
  const { gatewayName, rawBody, headers } = params;
  const gateway = getPaymentGateway(gatewayName);

  // 1. Validar autenticidade da assinatura
  const isSignatureValid = await gateway.verifyWebhookSignature(headers, rawBody);
  if (!isSignatureValid) {
    throw new Error("INVALID_WEBHOOK_SIGNATURE");
  }

  let payload: any = {};
  try {
    payload = JSON.parse(rawBody);
  } catch {
    payload = { raw: rawBody };
  }

  // 2. Extrair dados do webhook
  const parsed = await gateway.parseWebhook(payload, headers);
  if (!parsed.isValid || !parsed.transactionId) {
    return { success: true, action: "IGNORED_NO_TRANSACTION_ID", transactionId: "" };
  }

  const { transactionId } = parsed;

  // 3. Consultar gateway para obter status autenticado real (Anti-Spoofing)
  let realPaymentData = await gateway.getPayment(transactionId).catch(() => null);

  // Se a consulta direta falhou ou mock, usar o status do parseWebhook
  const targetStatus = realPaymentData ? realPaymentData.status : parsed.status || PaymentStatus.APPROVED;

  // 4. Localizar registro de pagamento local
  let payment = await prisma.payment.findFirst({
    where: { transactionId },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
    },
  });

  // Se não localizou por transactionId, tentar por external_reference se houver
  if (!payment && payload.data?.external_reference) {
    payment = await prisma.payment.findFirst({
      where: { orderId: payload.data.external_reference },
      include: {
        order: {
          include: {
            customer: true,
          },
        },
      },
    });
  }

  if (!payment) {
    // Se o pagamento não foi encontrado no banco, responder 200 para o gateway não repetir
    return { success: true, action: "PAYMENT_RECORD_NOT_FOUND", transactionId };
  }

  // 5. CHECAGEM DE IDEMPOTÊNCIA: Se o pagamento já se encontra no status alvo, ignorar sem duplicar
  if (payment.status === targetStatus) {
    return {
      success: true,
      action: "IDEMPOTENT_ALREADY_PROCESSED",
      transactionId,
      status: payment.status,
    };
  }

  // 6. Atualização Transacional Atômica com checagem interna de concorrência
  await prisma.$transaction(async (tx) => {
    // Atualização condicional atômica: apenas se o status ainda não for o targetStatus
    const updateResult = await tx.payment.updateMany({
      where: {
        id: payment.id,
        status: { not: targetStatus },
      },
      data: {
        status: targetStatus,
        paidAt: targetStatus === PaymentStatus.APPROVED ? (realPaymentData?.paidAt || new Date()) : undefined,
        failedAt: targetStatus === PaymentStatus.FAILED ? new Date() : undefined,
        refundedAt: targetStatus === PaymentStatus.REFUNDED ? new Date() : undefined,
        failureReason:
          targetStatus === PaymentStatus.FAILED
            ? (realPaymentData?.failureReason || "Pagamento recusado pelo gateway")
            : undefined,
        transactionId,
      },
    });

    if (updateResult.count === 0) {
      return; // Já foi atualizado por outra thread/requisição concorrente
    }

    const currentOrder = await tx.order.findUnique({
      where: { id: payment.orderId },
      include: { customer: true },
    });

    if (!currentOrder) return;

    // Caso A: Transição para APPROVED
    if (targetStatus === PaymentStatus.APPROVED) {
      if (currentOrder.status !== OrderStatus.PAID) {
        await tx.order.update({
          where: { id: currentOrder.id },
          data: { status: OrderStatus.PAID },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: currentOrder.id,
            previousStatus: currentOrder.status,
            newStatus: OrderStatus.PAID,
            reason: `Pagamento aprovado via webhook ${gateway.name} (Tx: ${transactionId}).`,
          },
        });

        // Publicar eventos na Outbox
        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.PAYMENT_APPROVED,
          entityType: "Payment",
          entityId: payment.id,
          data: {
            paymentId: payment.id,
            orderId: currentOrder.id,
            orderNumber: currentOrder.orderNumber,
            gateway: gateway.name,
            method: payment.method,
            amount: Number(payment.amount),
            transactionId,
          },
        });

        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.ORDER_PAID,
          entityType: "Order",
          entityId: currentOrder.id,
          data: {
            orderId: currentOrder.id,
            orderNumber: currentOrder.orderNumber,
            status: OrderStatus.PAID,
            totalAmount: Number(currentOrder.totalAmount),
            customerId: currentOrder.customerId,
            customerName: currentOrder.customer?.name || "",
            customerEmail: currentOrder.customer?.email || "",
          },
        });
      }
    }

    // Caso B: Transição para FAILED
    else if (targetStatus === PaymentStatus.FAILED) {
      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.PAYMENT_FAILED,
        entityType: "Payment",
        entityId: payment.id,
        data: {
          paymentId: payment.id,
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          gateway: gateway.name,
          method: payment.method,
          amount: Number(payment.amount),
          failureReason: realPaymentData?.failureReason,
        },
      });
    }

    // Caso C: Transição para REFUNDED
    else if (targetStatus === PaymentStatus.REFUNDED) {
      await tx.order.update({
        where: { id: currentOrder.id },
        data: { status: OrderStatus.REFUNDED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: currentOrder.id,
          previousStatus: currentOrder.status,
          newStatus: OrderStatus.REFUNDED,
          reason: `Reembolso confirmado via webhook ${gateway.name}.`,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_REFUNDED,
        entityType: "Order",
        entityId: currentOrder.id,
        data: {
          orderId: currentOrder.id,
          orderNumber: currentOrder.orderNumber,
          totalAmount: Number(currentOrder.totalAmount),
        },
      });
    }
  });

  return {
    success: true,
    action: `PROCESSED_STATUS_${targetStatus}`,
    transactionId,
    status: targetStatus,
  };
}

/**
 * Cancela uma cobrança pendente
 */
export async function cancelOrderPayment(paymentId: string, reason?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { order: true },
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (payment.status !== PaymentStatus.PENDING) {
    throw new Error(`CANNOT_CANCEL_STATUS_${payment.status}`);
  }

  const gateway = getPaymentGateway(payment.gateway);
  if (payment.transactionId) {
    await gateway.cancelPayment(payment.transactionId).catch(() => null);
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: PaymentStatus.CANCELLED,
      cancelledAt: new Date(),
      failureReason: reason || "Cancelado pelo operador administrativo.",
    },
  });

  return updated;
}

/**
 * Reembolsa integralmente um pagamento aprovado
 */
export async function refundOrderPayment(paymentId: string, reason?: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: { customer: true },
      },
    },
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  if (payment.status !== PaymentStatus.APPROVED) {
    throw new Error("ONLY_APPROVED_PAYMENTS_CAN_BE_REFUNDED");
  }

  const gateway = getPaymentGateway(payment.gateway);
  if (payment.transactionId) {
    const refundRes = await gateway.refundPayment(payment.transactionId);
    if (!refundRes.success) {
      throw new Error(`GATEWAY_REFUND_ERROR: ${refundRes.errorMessage || "Erro no gateway"}`);
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const p = await tx.payment.update({
      where: { id: paymentId },
      data: {
        status: PaymentStatus.REFUNDED,
        refundedAt: new Date(),
      },
    });

    await tx.order.update({
      where: { id: payment.orderId },
      data: { status: OrderStatus.REFUNDED },
    });

    await tx.orderStatusHistory.create({
      data: {
        orderId: payment.orderId,
        previousStatus: payment.order.status,
        newStatus: OrderStatus.REFUNDED,
        reason: reason || "Reembolso integral processado.",
      },
    });

    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.ORDER_REFUNDED,
      entityType: "Order",
      entityId: payment.orderId,
      data: {
        orderId: payment.orderId,
        orderNumber: payment.order.orderNumber,
        totalAmount: Number(payment.order.totalAmount),
        reason: reason || null,
      },
    });

    return p;
  });

  return updated;
}

/**
 * Obtém detalhes completos de um pagamento
 */
export async function getPaymentDetails(paymentId: string) {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      order: {
        include: {
          customer: { select: { id: true, name: true, email: true, phone: true } },
          items: true,
          statusHistory: { orderBy: { createdAt: "desc" } },
        },
      },
    },
  });

  if (!payment) {
    throw new Error("PAYMENT_NOT_FOUND");
  }

  return payment;
}

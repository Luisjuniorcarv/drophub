import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CreatePaymentSchema } from "@/lib/validators";
import { createCheckoutPayment } from "@/modules/payments/service";
import { PaymentMethod } from "@prisma/client";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id: orderId } = await params;

    const body = await req.json().catch(() => ({}));
    const parseResult = CreatePaymentSchema.safeParse({ ...body, orderId });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de pagamento inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { method, gatewayName, cardToken, installments, paymentMethodId, issuerId, payer } =
      parseResult.data;

    const result = await createCheckoutPayment({
      orderId,
      method: method as PaymentMethod,
      gatewayName,
      cardToken,
      installments,
      paymentMethodId,
      issuerId,
      payer,
    });

    return NextResponse.json(
      {
        success: result.gatewayResult.success,
        payment: {
          id: result.payment.id,
          orderId: result.payment.orderId,
          gateway: result.payment.gateway,
          method: result.payment.method,
          status: result.payment.status,
          amount: Number(result.payment.amount),
          transactionId: result.payment.transactionId,
          qrCode: result.payment.qrCode,
          qrCodeBase64: result.payment.qrCodeBase64,
          expiresAt: result.payment.expiresAt,
          paidAt: result.payment.paidAt,
          failureReason: result.payment.failureReason,
        },
        gatewayResult: result.gatewayResult,
      },
      { status: result.gatewayResult.success ? 201 : 400 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (error.message === "ORDER_ALREADY_PAID") {
      return NextResponse.json({ error: "Este pedido já foi pago anteriormente." }, { status: 400 });
    }

    console.error("[API_ADMIN_ORDER_PAYMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao criar cobrança para o pedido.", details: error.message },
      { status: 500 }
    );
  }
}

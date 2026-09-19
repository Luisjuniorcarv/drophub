import { NextRequest, NextResponse } from "next/server";
import { CreatePaymentSchema } from "@/lib/validators";
import { createCheckoutPayment } from "@/modules/payments/service";
import { PaymentMethod } from "@prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CreatePaymentSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de pagamento inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { orderId, method, gatewayName, cardToken, installments, paymentMethodId, issuerId, payer } =
      parseResult.data;

    if (!orderId) {
      return NextResponse.json({ error: "O campo 'orderId' é obrigatório." }, { status: 400 });
    }

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
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (error.message === "ORDER_ALREADY_PAID") {
      return NextResponse.json({ error: "Este pedido já foi pago anteriormente." }, { status: 400 });
    }
    if (error.message === "ORDER_CANCELLED" || error.message === "ORDER_REFUNDED") {
      return NextResponse.json(
        { error: `Não é possível efetuar pagamento de um pedido com status ${error.message}.` },
        { status: 400 }
      );
    }

    console.error("[API_CHECKOUT_PAYMENT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao processar pagamento.", details: error.message },
      { status: 500 }
    );
  }
}

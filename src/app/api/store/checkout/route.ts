import { NextRequest, NextResponse } from "next/server";
import { StorefrontCheckoutSchema } from "@/lib/validators";
import { createStorefrontOrder } from "@/modules/storefront/service";
import { createCheckoutPayment } from "@/modules/payments/service";
import { getCustomerSession } from "@/modules/customer/auth";
import { PaymentMethod } from "@prisma/client";

const CART_COOKIE_NAME = "drophub_cart";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = StorefrontCheckoutSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de checkout inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      customer: customerData,
      shippingAddress,
      items,
      paymentMethod,
      gatewayName,
      cardToken,
      installments,
      paymentMethodId,
      issuerId,
      notes,
    } = parseResult.data;

    // Verificar se o cliente está autenticado para associar o ID da conta
    const session = await getCustomerSession();

    // 1. Criar o Pedido com recálculo seguro no PostgreSQL
    const order = await createStorefrontOrder({
      customer: {
        id: session?.id,
        name: customerData.name,
        email: customerData.email,
        cpf: customerData.cpf,
        phone: customerData.phone,
      },
      shippingAddress,
      items,
      paymentMethod: paymentMethod as PaymentMethod,
      notes,
    });

    // 2. Iniciar Cobrança através da infraestrutura da ETAPA 8
    let paymentResult: any = null;
    try {
      paymentResult = await createCheckoutPayment({
        orderId: order.id,
        method: paymentMethod as PaymentMethod,
        gatewayName,
        cardToken,
        installments,
        paymentMethodId,
        issuerId,
        payer: {
          name: customerData.name,
          email: customerData.email,
          cpf: customerData.cpf,
          phone: customerData.phone,
        },
      });
    } catch (payErr: any) {
      console.warn("[STORE_CHECKOUT_PAYMENT_INIT_WARN]", payErr.message);
      // O pedido foi criado em AWAITING_PAYMENT, o cliente poderá continuar na tela de pagamento
    }

    const response = NextResponse.json(
      {
        success: true,
        message: "Pedido criado com sucesso.",
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          trackingToken: order.trackingToken,
          status: order.status,
          totalAmount: Number(order.totalAmount),
          itemsCount: order.items.length,
        },
        payment: paymentResult
          ? {
              id: paymentResult.payment.id,
              method: paymentResult.payment.method,
              status: paymentResult.payment.status,
              amount: Number(paymentResult.payment.amount),
              qrCode: paymentResult.payment.qrCode,
              qrCodeBase64: paymentResult.payment.qrCodeBase64,
              expiresAt: paymentResult.payment.expiresAt,
            }
          : null,
      },
      { status: 201 }
    );

    // 3. Limpar o carrinho após criação bem-sucedida do pedido
    response.cookies.delete(CART_COOKIE_NAME);

    return response;
  } catch (error: any) {
    if (error.message === "SOME_PRODUCTS_UNAVAILABLE") {
      return NextResponse.json(
        { error: "Um ou mais produtos selecionados não estão mais disponíveis no catálogo." },
        { status: 400 }
      );
    }
    if (error.message?.startsWith("INSUFFICIENT_STOCK_")) {
      const prodName = error.message.replace("INSUFFICIENT_STOCK_", "");
      return NextResponse.json(
        { error: `Estoque insuficiente para o produto: ${prodName}` },
        { status: 400 }
      );
    }
    if (error.message?.startsWith("VARIANT_NOT_FOUND_")) {
      const prodName = error.message.replace("VARIANT_NOT_FOUND_", "");
      return NextResponse.json(
        { error: `A variação escolhida para o produto ${prodName} não foi encontrada.` },
        { status: 400 }
      );
    }
    console.error("[STORE_CHECKOUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao processar checkout." }, { status: 500 });
  }
}

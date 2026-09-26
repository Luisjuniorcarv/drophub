import { NextRequest, NextResponse } from "next/server";
import { getCustomerSession } from "@/modules/customer/auth";
import { getStorefrontOrder } from "@/modules/storefront/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const { searchParams } = new URL(req.url);
    const trackingToken = searchParams.get("token");

    const session = await getCustomerSession();

    let order = await getStorefrontOrder({
      orderId: id,
      customerId: session?.id || null,
      trackingToken: trackingToken || null,
    });

    // Auto-sync em tempo real: se o pedido ainda não consta como PAID e tem transação no gateway
    if (order && order.status !== "PAID" && (order as any).payments?.length > 0) {
      const pendingPayment = (order as any).payments.find(
        (p: any) => p.status === "PENDING" && p.transactionId
      );
      if (pendingPayment) {
        try {
          const { getPaymentGateway } = await import("@/modules/payments/gateway-factory");
          const gateway = getPaymentGateway(pendingPayment.gateway);
          const realPayment = await gateway.getPayment(pendingPayment.transactionId);
          if (realPayment && realPayment.status === "APPROVED") {
            const { processPaymentWebhook } = await import("@/modules/payments/service");
            await processPaymentWebhook({
              gatewayName: pendingPayment.gateway,
              rawBody: JSON.stringify({
                action: "payment.updated",
                type: "payment",
                data: { id: pendingPayment.transactionId },
              }),
              headers: {},
            });
            order = await getStorefrontOrder({
              orderId: id,
              customerId: session?.id || null,
              trackingToken: trackingToken || null,
            });
          }
        } catch (syncErr) {
          console.warn("[PAYMENT_AUTO_SYNC_WARN] Falha ao verificar pagamento:", syncErr);
        }
      }
    }

    return NextResponse.json({
      success: true,
      order,
    });
  } catch (error: any) {
    if (error.message === "ORDER_NOT_FOUND") {
      return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }
    if (error.message === "FORBIDDEN") {
      return NextResponse.json(
        { error: "Acesso negado. Você não tem permissão para visualizar este pedido." },
        { status: 403 }
      );
    }
    console.error("[CUSTOMER_ORDER_DETAIL_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar pedido." }, { status: 500 });
  }
}

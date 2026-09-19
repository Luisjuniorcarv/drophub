import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { RefundPaymentSchema } from "@/lib/validators";
import { refundOrderPayment } from "@/modules/payments/service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parseResult = RefundPaymentSchema.safeParse(body);
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    const updatedPayment = await refundOrderPayment(id, reason);

    return NextResponse.json({
      success: true,
      message: "Reembolso integral processado com sucesso.",
      data: updatedPayment,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    }
    if (error.message === "ONLY_APPROVED_PAYMENTS_CAN_BE_REFUNDED") {
      return NextResponse.json(
        { error: "Apenas pagamentos aprovados podem ser estornados/reembolsados." },
        { status: 400 }
      );
    }

    console.error("[API_PAYMENT_REFUND_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao reembolsar pagamento.", details: error.message },
      { status: 500 }
    );
  }
}

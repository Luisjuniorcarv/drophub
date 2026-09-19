import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { CancelPaymentSchema } from "@/lib/validators";
import { cancelOrderPayment } from "@/modules/payments/service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const body = await req.json().catch(() => ({}));
    const parseResult = CancelPaymentSchema.safeParse(body);
    const reason = parseResult.success ? parseResult.data.reason : undefined;

    const updatedPayment = await cancelOrderPayment(id, reason);

    return NextResponse.json({
      success: true,
      message: "Pagamento cancelado com sucesso.",
      data: updatedPayment,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    }
    if (error.message?.startsWith("CANNOT_CANCEL_STATUS_")) {
      return NextResponse.json(
        { error: "Apenas pagamentos pendentes podem ser cancelados." },
        { status: 400 }
      );
    }

    console.error("[API_PAYMENT_CANCEL_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao cancelar pagamento.", details: error.message },
      { status: 500 }
    );
  }
}

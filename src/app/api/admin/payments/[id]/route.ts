import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getPaymentDetails } from "@/modules/payments/service";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const payment = await getPaymentDetails(id);

    return NextResponse.json({
      success: true,
      data: payment,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "PAYMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Pagamento não encontrado." }, { status: 404 });
    }

    console.error("[API_ADMIN_PAYMENT_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar dados do pagamento." }, { status: 500 });
  }
}

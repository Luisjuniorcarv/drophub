import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { submitFulfillmentOrder } from "@/modules/fulfillment/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    await requireAuth();

    const { id } = await props.params;
    const body = await req.json().catch(() => ({}));

    const result = await submitFulfillmentOrder(id, { force: body.force });

    return NextResponse.json({
      success: result.success,
      action: result.action,
      data: result.fulfillment,
      errorMessage: result.errorMessage,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "FULFILLMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }
    if (error.message === "FULFILLMENT_CANCELLED") {
      return NextResponse.json(
        { error: "Não é permitido enviar uma ordem de fulfillment cancelada." },
        { status: 400 }
      );
    }
    console.error("[API_FULFILLMENT_SUBMIT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao enviar ordem para o fornecedor." }, { status: 500 });
  }
}

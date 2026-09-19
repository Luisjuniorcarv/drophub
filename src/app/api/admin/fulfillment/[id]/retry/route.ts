import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { retryFulfillmentOrder } from "@/modules/fulfillment/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    const user = await requireAuth();
    const { id } = await props.params;

    const result = await retryFulfillmentOrder(id, user.id);

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
    console.error("[API_FULFILLMENT_RETRY_ERROR]", error);
    return NextResponse.json({ error: "Erro ao reprocessar fulfillment." }, { status: 500 });
  }
}

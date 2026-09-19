import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import {
  markFulfillmentDelivered,
  cancelFulfillmentOrder,
} from "@/modules/fulfillment/service";
import { UpdateFulfillmentStatusSchema } from "@/lib/validators";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    const user = await requireAuth();
    const { id } = await props.params;

    const body = await req.json();
    const parseResult = UpdateFulfillmentStatusSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Status inválido.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { status, reason } = parseResult.data;

    if (status === "DELIVERED") {
      const updated = await markFulfillmentDelivered(id, user.id);
      return NextResponse.json({
        success: true,
        message: "Ordem de fulfillment marcada como entregue.",
        data: updated,
      });
    }

    if (status === "CANCELLED") {
      const updated = await cancelFulfillmentOrder(
        id,
        reason || "Cancelamento manual pelo operador",
        user.id
      );
      return NextResponse.json({
        success: true,
        message: "Ordem de fulfillment cancelada.",
        data: updated,
      });
    }

    return NextResponse.json(
      { error: "Transição de status não suportada diretamente por este endpoint." },
      { status: 400 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "FULFILLMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }
    if (error.message === "CANNOT_CANCEL_DELIVERED_FULFILLMENT") {
      return NextResponse.json(
        { error: "Não é possível cancelar uma ordem que já foi entregue." },
        { status: 400 }
      );
    }
    console.error("[API_FULFILLMENT_STATUS_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar status do fulfillment." }, { status: 500 });
  }
}

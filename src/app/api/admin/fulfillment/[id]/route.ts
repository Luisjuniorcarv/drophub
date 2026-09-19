import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { getFulfillmentOrderById } from "@/modules/fulfillment/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, props: Props) {
  try {
    await requireAuth();

    const { id } = await props.params;
    const fulfillment = await getFulfillmentOrderById(id);

    if (!fulfillment) {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: fulfillment,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    console.error("[API_FULFILLMENT_GET_ID_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar ordem de fulfillment." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { syncFulfillmentStatusFromSupplier } from "@/modules/fulfillment/service";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    const user = await requireAuth();
    const { id } = await props.params;

    const result = await syncFulfillmentStatusFromSupplier(id, user.id);

    return NextResponse.json({
      success: result.success,
      data: result,
      message: result.message,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "FULFILLMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }
    console.error("[API_FULFILLMENT_SYNC_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao sincronizar status com o fornecedor.", details: error.message },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { updateFulfillmentTracking } from "@/modules/fulfillment/service";
import { UpdateFulfillmentTrackingSchema } from "@/lib/validators";

interface Props {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, props: Props) {
  try {
    const user = await requireAuth();
    const { id } = await props.params;

    const body = await req.json();
    const parseResult = UpdateFulfillmentTrackingSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Dados de rastreamento inválidos.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { carrier, trackingNumber, trackingUrl, shippedAt } = parseResult.data;

    const result = await updateFulfillmentTracking(
      id,
      {
        carrier,
        trackingNumber,
        trackingUrl: trackingUrl || undefined,
        shippedAt: shippedAt ? new Date(shippedAt) : undefined,
      },
      user.id
    );

    return NextResponse.json({
      success: true,
      message: "Rastreamento atualizado e pacote marcado como enviado.",
      data: result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "FULFILLMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }
    if (error.message === "CANNOT_TRACK_CANCELLED_FULFILLMENT") {
      return NextResponse.json(
        { error: "Não é possível adicionar rastreamento a um fulfillment cancelado." },
        { status: 400 }
      );
    }
    console.error("[API_FULFILLMENT_TRACKING_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar rastreamento." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { switchFulfillmentSupplier } from "@/modules/fulfillment/service";
import { z } from "zod";

interface Props {
  params: Promise<{ id: string }>;
}

const switchSupplierSchema = z.object({
  newSupplierId: z.string().min(1, "O ID do novo fornecedor é obrigatório."),
  reason: z.string().min(3, "O motivo da substituição de fornecedor é obrigatório."),
});

export async function POST(req: NextRequest, props: Props) {
  try {
    const user = await requireAuth();
    const { id } = await props.params;

    const body = await req.json().catch(() => ({}));
    const validated = switchSupplierSchema.parse(body);

    const updated = await switchFulfillmentSupplier(
      id,
      validated.newSupplierId,
      validated.reason,
      user.id
    );

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Fornecedor substituído com sucesso. Fulfillment retornado ao estado PENDENTE para envio.",
    });
  } catch (error: any) {
    if (error.name === "ZodError") {
      return NextResponse.json(
        { error: "Dados inválidos.", details: error.errors },
        { status: 400 }
      );
    }
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    if (error.message === "FULFILLMENT_NOT_FOUND") {
      return NextResponse.json({ error: "Ordem de fulfillment não encontrada." }, { status: 404 });
    }
    if (error.message === "NEW_SUPPLIER_NOT_FOUND") {
      return NextResponse.json({ error: "Novo fornecedor selecionado não existe." }, { status: 404 });
    }
    if (error.message === "CANNOT_SWITCH_SUPPLIER_FOR_SHIPPED_OR_DELIVERED_ORDER") {
      return NextResponse.json(
        { error: "Não é permitido trocar fornecedor de ordens já despachadas ou entregues." },
        { status: 400 }
      );
    }
    console.error("[API_SWITCH_SUPPLIER_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao substituir fornecedor.", details: error.message },
      { status: 500 }
    );
  }
}

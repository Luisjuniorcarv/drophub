import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { RestockInputSchema } from "@/lib/validators";
import { restockProduct } from "@/modules/stock";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await req.json();
    const parseResult = RestockInputSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de reposição inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const result = await restockProduct({
      ...parseResult.data,
      userId: user.id,
    });

    return NextResponse.json(
      {
        success: true,
        data: result,
        message: "Reposição de estoque realizada com sucesso.",
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message === "PRODUCT_NOT_FOUND" || error.message === "VARIANT_NOT_FOUND") {
      return NextResponse.json({ error: "Produto ou variação não encontrado." }, { status: 404 });
    }
    console.error("[API_STOCK_RESTOCK_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro ao realizar reposição de estoque." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const { supplierId } = await req.json();

    if (!supplierId) {
      return NextResponse.json({ error: "supplierId é obrigatório." }, { status: 400 });
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    // Vincular todos os produtos sem fornecedor (ou todos os produtos da loja)
    const result = await prisma.product.updateMany({
      where: {
        OR: [
          { supplierId: null },
          { supplierId: undefined },
        ],
      },
      data: {
        supplierId,
      },
    });

    return NextResponse.json({
      success: true,
      updatedCount: result.count,
      supplierName: supplier.name,
      message: `${result.count} produtos vinculados com sucesso ao fornecedor ${supplier.name}.`,
    });
  } catch (error: any) {
    console.error("[LINK_PRODUCTS_ERROR]", error);
    return NextResponse.json({ error: error.message || "Erro ao vincular produtos." }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { SupplierSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        products: {
          select: {
            id: true,
            name: true,
            sku: true,
            costPrice: true,
            sellingPrice: true,
            stock: true,
            status: true,
          },
        },
        _count: {
          select: { products: true, shipments: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      supplier: {
        ...supplier,
        productsCount: supplier._count.products,
        shipmentsCount: supplier._count.shipments,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar fornecedor." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = SupplierSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do fornecedor inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, contactName, email, phone, website, notes, active } = parseResult.data;

    const updated = await prisma.supplier.update({
      where: { id },
      data: {
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        active,
      },
    });

    return NextResponse.json({ success: true, supplier: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar fornecedor." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true, shipments: true },
        },
      },
    });

    if (!supplier) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }

    if (supplier._count.products > 0 || supplier._count.shipments > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir este fornecedor pois existem ${supplier._count.products} produto(s) ou ${supplier._count.shipments} envio(s) vinculados a ele.`,
        },
        { status: 400 }
      );
    }

    await prisma.supplier.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Fornecedor excluído com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir fornecedor." }, { status: 500 });
  }
}

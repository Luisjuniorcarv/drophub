import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CategorySchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      category: {
        ...category,
        productsCount: category._count.products,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATEGORY_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar categoria." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.category.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CategorySchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados da categoria inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, slug, description, active } = parseResult.data;

    // Se o slug mudou, verifica unicidade
    if (slug !== existing.slug) {
      const slugInUse = await prisma.category.findUnique({ where: { slug } });
      if (slugInUse && slugInUse.id !== id) {
        return NextResponse.json(
          { error: "Já existe outra categoria com este slug." },
          { status: 409 }
        );
      }
    }

    const updated = await prisma.category.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        active,
      },
    });

    return NextResponse.json({ success: true, category: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATEGORY_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar categoria." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    if (category._count.products > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir esta categoria pois existem ${category._count.products} produto(s) vinculado(s) a ela.`,
        },
        { status: 400 }
      );
    }

    await prisma.category.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Categoria excluída com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATEGORY_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir categoria." }, { status: 500 });
  }
}

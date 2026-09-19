import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getStorefrontProducts } from "@/modules/storefront/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const category = await prisma.category.findFirst({
      where: { slug, active: true },
    });

    if (!category) {
      return NextResponse.json({ error: "Categoria não encontrada." }, { status: 404 });
    }

    const { searchParams } = new URL(req.url);
    const sort = (searchParams.get("sort") as any) || "newest";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));

    const productsResult = await getStorefrontProducts({
      categorySlug: slug,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      category: {
        id: category.id,
        name: category.name,
        slug: category.slug,
        description: category.description,
      },
      ...productsResult,
    });
  } catch (error: any) {
    console.error("[STORE_CATEGORY_SLUG_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao carregar categoria." }, { status: 500 });
  }
}

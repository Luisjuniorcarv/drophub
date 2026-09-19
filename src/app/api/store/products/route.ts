import { NextRequest, NextResponse } from "next/server";
import { getStorefrontProducts } from "@/modules/storefront/service";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const categorySlug = searchParams.get("categorySlug") || searchParams.get("categoria") || undefined;
    const search = searchParams.get("q") || searchParams.get("busca") || undefined;
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const sort = (searchParams.get("sort") as any) || "newest";
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 12));

    const result = await getStorefrontProducts({
      categorySlug,
      search,
      minPrice,
      maxPrice,
      sort,
      page,
      limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("[STORE_PRODUCTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar produtos." }, { status: 500 });
  }
}

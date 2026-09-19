import { NextRequest, NextResponse } from "next/server";
import { getStorefrontProductBySlug } from "@/modules/storefront/service";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const product = await getStorefrontProductBySlug(slug);

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error: any) {
    console.error("[STORE_PRODUCT_SLUG_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao consultar produto." }, { status: 500 });
  }
}

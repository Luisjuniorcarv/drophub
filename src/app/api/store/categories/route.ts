import { NextResponse } from "next/server";
import { getStorefrontCategories } from "@/modules/storefront/service";

export async function GET() {
  try {
    const categories = await getStorefrontCategories();
    return NextResponse.json({
      success: true,
      categories,
    });
  } catch (error: any) {
    console.error("[STORE_CATEGORIES_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar categorias." }, { status: 500 });
  }
}

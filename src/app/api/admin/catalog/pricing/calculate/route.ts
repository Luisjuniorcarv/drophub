import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { PricingCalculationRequestSchema } from "@/lib/validators";
import { PricingService } from "@/modules/catalog/pricing-service";

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = PricingCalculationRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Parâmetros de precificação inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const simulation = PricingService.calculateSuggestedPrice(parseResult.data);

    return NextResponse.json({
      success: true,
      simulation,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CATALOG_PRICING_CALCULATE_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao simular precificação." },
      { status: 500 }
    );
  }
}

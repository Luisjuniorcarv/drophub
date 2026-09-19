import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { AIApiRequestSchema } from "@/modules/ai/types";
import { AIService } from "@/modules/ai/service";

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();

    const body = await req.json();
    const parseResult = AIApiRequestSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Parâmetros da requisição de IA inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { assistant, prompt, contextData } = parseResult.data;

    const result = await AIService.executeAssistant({
      assistant,
      prompt,
      contextData,
      userId: user.id,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_ADMIN_AI_ERROR]", error);
    return NextResponse.json(
      { error: error.message || "Erro ao consultar assistente de IA." },
      { status: 500 }
    );
  }
}

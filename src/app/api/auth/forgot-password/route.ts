import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestPasswordReset } from "@/modules/customer/password-recovery";
import { handleApiError } from "@/lib/api-response";

const ForgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ForgotPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "E-mail inválido.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await requestPasswordReset(parseResult.data.email);

    return NextResponse.json({
      success: true,
      message: result.message,
      ...(result.devToken ? { devToken: result.devToken } : {}),
    });
  } catch (error: any) {
    return handleApiError(error, "Erro ao solicitar recuperação de senha.");
  }
}

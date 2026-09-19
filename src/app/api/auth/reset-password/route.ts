import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resetPasswordWithToken } from "@/modules/customer/password-recovery";
import { handleApiError } from "@/lib/api-response";

const ResetPasswordSchema = z.object({
  token: z.string().min(16, "Token inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = ResetPasswordSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Dados inválidos.", details: parseResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await resetPasswordWithToken(
      parseResult.data.token,
      parseResult.data.password
    );

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    if (
      error.message === "INVALID_TOKEN" ||
      error.message === "TOKEN_ALREADY_USED" ||
      error.message === "TOKEN_EXPIRED"
    ) {
      return NextResponse.json(
        { error: "Token de redefinição inválido, expirado ou já utilizado." },
        { status: 400 }
      );
    }

    return handleApiError(error, "Erro ao redefinir a senha.");
  }
}

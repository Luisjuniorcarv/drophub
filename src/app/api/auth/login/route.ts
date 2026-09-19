import { NextRequest, NextResponse } from "next/server";
import { authenticateUser } from "@/modules/auth/service";
import { LoginSchema } from "@/lib/validators";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = LoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de login inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { email, password } = parseResult.data;
    const authResult = await authenticateUser(email, password);

    if (!authResult.success || !authResult.user) {
      return NextResponse.json(
        { error: authResult.error || "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }

    // Retorna os dados públicos da sessão (sem tokens, sem hashes)
    return NextResponse.json({
      success: true,
      user: {
        id: authResult.user.id,
        name: authResult.user.name,
        email: authResult.user.email,
        role: authResult.user.role,
      },
    });
  } catch (error) {
    console.error("[API_AUTH_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno no servidor ao processar autenticação." },
      { status: 500 }
    );
  }
}

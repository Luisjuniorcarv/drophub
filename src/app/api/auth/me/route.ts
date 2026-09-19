import { NextResponse } from "next/server";
import { getCurrentUser } from "@/modules/auth/service";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "Não autenticado." },
        { status: 401 }
      );
    }

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("[API_AUTH_ME_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao obter dados da sessão." },
      { status: 500 }
    );
  }
}

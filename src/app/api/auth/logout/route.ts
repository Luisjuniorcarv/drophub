import { NextResponse } from "next/server";
import { logoutUser } from "@/modules/auth/service";

export async function POST() {
  try {
    await logoutUser();
    return NextResponse.json({
      success: true,
      message: "Sessão encerrada com sucesso.",
    });
  } catch (error) {
    console.error("[API_AUTH_LOGOUT_ERROR]", error);
    return NextResponse.json(
      { error: "Erro ao realizar logout." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { CustomerLoginSchema } from "@/lib/validators";
import { loginCustomer } from "@/modules/customer/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CustomerLoginSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Credenciais inválidas.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const customer = await loginCustomer(parseResult.data);

    return NextResponse.json({
      success: true,
      message: "Login realizado com sucesso.",
      customer,
    });
  } catch (error: any) {
    if (error.message === "INVALID_CREDENTIALS") {
      return NextResponse.json(
        { error: "E-mail ou senha incorretos." },
        { status: 401 }
      );
    }
    console.error("[CUSTOMER_LOGIN_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao processar login." },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { CustomerRegisterSchema } from "@/lib/validators";
import { registerCustomer } from "@/modules/customer/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parseResult = CustomerRegisterSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de cadastro inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const customer = await registerCustomer(parseResult.data);

    return NextResponse.json(
      {
        success: true,
        message: "Cadastro realizado com sucesso.",
        customer,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "EMAIL_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com este e-mail." },
        { status: 409 }
      );
    }
    if (error.message === "CPF_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Já existe uma conta cadastrada com este CPF." },
        { status: 409 }
      );
    }
    console.error("[CUSTOMER_REGISTER_ERROR]", error);
    return NextResponse.json(
      { error: "Erro interno ao processar cadastro." },
      { status: 500 }
    );
  }
}

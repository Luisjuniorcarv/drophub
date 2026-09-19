import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CustomerAddressSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CustomerAddressSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do endereço inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { street, number, complement, neighborhood, city, state, postalCode, isDefault } =
      parseResult.data;

    // Se este for o padrão, remove o padrão dos outros
    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId: id },
        data: { isDefault: false },
      });
    }

    const address = await prisma.customerAddress.create({
      data: {
        customerId: id,
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state: state.toUpperCase(),
        postalCode: postalCode.replace(/\D/g, ""),
        isDefault: isDefault ?? false,
      },
    });

    return NextResponse.json({ success: true, address }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_ADDRESS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao adicionar endereço." }, { status: 500 });
  }
}

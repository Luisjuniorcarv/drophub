import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CustomerAddressSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string; addressId: string }>;
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id, addressId } = await params;

    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
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

    if (isDefault) {
      await prisma.customerAddress.updateMany({
        where: { customerId: id, id: { not: addressId } },
        data: { isDefault: false },
      });
    }

    const updated = await prisma.customerAddress.update({
      where: { id: addressId },
      data: {
        street,
        number,
        complement: complement || null,
        neighborhood,
        city,
        state: state.toUpperCase(),
        postalCode: postalCode.replace(/\D/g, ""),
        isDefault,
      },
    });

    return NextResponse.json({ success: true, address: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_ADDRESS_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar endereço." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id, addressId } = await params;

    const existing = await prisma.customerAddress.findFirst({
      where: { id: addressId, customerId: id },
    });

    if (!existing) {
      return NextResponse.json({ error: "Endereço não encontrado." }, { status: 404 });
    }

    await prisma.customerAddress.delete({ where: { id: addressId } });

    return NextResponse.json({
      success: true,
      message: "Endereço excluído com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_ADDRESS_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir endereço." }, { status: 500 });
  }
}

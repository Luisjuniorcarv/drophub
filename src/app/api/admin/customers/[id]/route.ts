import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CustomerSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: { orderBy: { isDefault: "desc" } },
        orders: {
          orderBy: { createdAt: "desc" },
          include: {
            items: true,
            payments: true,
            shipments: true,
          },
        },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, customer, data: customer });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar cliente." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = CustomerSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do cliente inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, email, cpf, phone, notes } = parseResult.data;
    const cleanCpf = cpf.replace(/\D/g, "");

    // Verificar unicidade se mudou e-mail ou CPF
    if (email.toLowerCase() !== existing.email) {
      const emailInUse = await prisma.customer.findUnique({ where: { email: email.toLowerCase() } });
      if (emailInUse && emailInUse.id !== id) {
        return NextResponse.json({ error: "E-mail já cadastrado para outro cliente." }, { status: 409 });
      }
    }

    if (cleanCpf !== existing.cpf) {
      const cpfInUse = await prisma.customer.findUnique({ where: { cpf: cleanCpf } });
      if (cpfInUse && cpfInUse.id !== id) {
        return NextResponse.json({ error: "CPF já cadastrado para outro cliente." }, { status: 409 });
      }
    }

    const updated = await prisma.customer.update({
      where: { id },
      data: {
        name,
        email: email.toLowerCase(),
        cpf: cleanCpf,
        phone,
        notes: notes || null,
      },
      include: { addresses: true },
    });

    return NextResponse.json({ success: true, customer: updated, data: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar cliente." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: { select: { orders: true } },
      },
    });

    if (!customer) {
      return NextResponse.json({ error: "Cliente não encontrado." }, { status: 404 });
    }

    if (customer._count.orders > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir este cliente pois ele possui ${customer._count.orders} pedido(s) registrado(s) no sistema.`,
        },
        { status: 400 }
      );
    }

    await prisma.customer.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Cliente excluído com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMER_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir cliente." }, { status: 500 });
  }
}

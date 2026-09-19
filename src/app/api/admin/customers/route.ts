import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { CustomerSchema } from "@/lib/validators";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (q) {
      const cleanDigits = q.replace(/\D/g, "");
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        ...(cleanDigits ? [{ cpf: { contains: cleanDigits } }, { phone: { contains: cleanDigits } }] : []),
      ];
    }

    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          addresses: {
            where: { isDefault: true },
            take: 1,
          },
          _count: {
            select: { orders: true },
          },
          orders: {
            select: {
              totalAmount: true,
              status: true,
            },
          },
        },
      }),
    ]);

    const formattedCustomers = customers.map((c) => {
      // Total gasto em pedidos aprovados/pagos
      const validOrders = c.orders.filter((o) =>
        ["PAID", "PROCESSING", "SENT_TO_SUPPLIER", "SHIPPED", "DELIVERED"].includes(o.status)
      );
      const totalSpent = validOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0);

      return {
        id: c.id,
        name: c.name,
        email: c.email,
        cpf: c.cpf,
        phone: c.phone,
        notes: c.notes,
        ordersCount: c._count.orders,
        totalSpent,
        defaultAddress: c.addresses[0] || null,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      };
    });

    return NextResponse.json({
      success: true,
      data: formattedCustomers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar clientes." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

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

    const { name, email, cpf, phone, notes, address } = parseResult.data;
    const cleanCpf = cpf.replace(/\D/g, "");

    // Verificar unicidade de e-mail e CPF
    const [existingEmail, existingCpf] = await Promise.all([
      prisma.customer.findUnique({ where: { email: email.toLowerCase() } }),
      prisma.customer.findUnique({ where: { cpf: cleanCpf } }),
    ]);

    if (existingEmail) {
      return NextResponse.json(
        { error: "Já existe um cliente cadastrado com este e-mail." },
        { status: 409 }
      );
    }

    if (existingCpf) {
      return NextResponse.json(
        { error: "Já existe um cliente cadastrado com este CPF." },
        { status: 409 }
      );
    }

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name,
          email: email.toLowerCase(),
          cpf: cleanCpf,
          phone,
          notes: notes || null,
          addresses: address
            ? {
                create: {
                  street: address.street,
                  number: address.number,
                  complement: address.complement || null,
                  neighborhood: address.neighborhood,
                  city: address.city,
                  state: address.state.toUpperCase(),
                  postalCode: address.postalCode.replace(/\D/g, ""),
                  isDefault: address.isDefault ?? true,
                },
              }
            : undefined,
        },
        include: {
          addresses: true,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.CUSTOMER_CREATED,
        entityType: "Customer",
        entityId: created.id,
        data: {
          customerId: created.id,
          name: created.name,
          email: created.email,
          phone: created.phone,
          createdAt: created.createdAt.toISOString(),
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, customer, data: customer }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_CUSTOMERS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao cadastrar cliente." }, { status: 500 });
  }
}

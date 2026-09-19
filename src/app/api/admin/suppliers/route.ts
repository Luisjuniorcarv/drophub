import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { SupplierSchema } from "@/lib/validators";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const activeParam = searchParams.get("active");

    const where: any = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { contactName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q, mode: "insensitive" } },
      ];
    }
    if (activeParam !== null && activeParam !== undefined) {
      where.active = activeParam === "true";
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: { products: true, shipments: true },
        },
        integration: {
          select: {
            id: true,
            provider: true,
            status: true,
            lastTestedAt: true,
            lastError: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      suppliers: suppliers.map((s) => ({
        id: s.id,
        name: s.name,
        contactName: s.contactName,
        email: s.email,
        phone: s.phone,
        website: s.website,
        notes: s.notes,
        active: s.active,
        productsCount: s._count.products,
        shipmentsCount: s._count.shipments,
        integration: s.integration
          ? {
              id: s.integration.id,
              provider: s.integration.provider,
              status: s.integration.status,
              lastTestedAt: s.integration.lastTestedAt,
              lastError: s.integration.lastError,
            }
          : null,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIERS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar fornecedores." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = SupplierSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do fornecedor inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, contactName, email, phone, website, notes, active } = parseResult.data;

    const supplier = await prisma.supplier.create({
      data: {
        name,
        contactName: contactName || null,
        email: email || null,
        phone: phone || null,
        website: website || null,
        notes: notes || null,
        active: active ?? true,
      },
    });

    return NextResponse.json({ success: true, supplier }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIERS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar fornecedor." }, { status: 500 });
  }
}

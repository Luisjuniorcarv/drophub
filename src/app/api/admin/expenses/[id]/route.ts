import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { ExpenseSchema } from "@/lib/validators";
import { ExpenseCategory } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        order: {
          select: { id: true, orderNumber: true, totalAmount: true },
        },
      },
    });

    if (!expense) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    }

    const formatted = {
      id: expense.id,
      title: expense.title,
      category: expense.category,
      amount: Number(expense.amount),
      date: expense.date,
      description: expense.description,
      orderId: expense.orderId,
      order: expense.order,
      createdAt: expense.createdAt,
      updatedAt: expense.updatedAt,
    };

    return NextResponse.json({ success: true, expense: formatted, data: formatted });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_EXPENSE_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar despesa." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = ExpenseSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados da despesa inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { title, category, amount, date, description, orderId } = parseResult.data;

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        title,
        category: category as ExpenseCategory,
        amount: new Decimal(amount),
        date: date ? new Date(date) : existing.date,
        description: description !== undefined ? description : existing.description,
        orderId: orderId !== undefined ? orderId : existing.orderId,
      },
      include: {
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    });

    const formatted = {
      id: updated.id,
      title: updated.title,
      category: updated.category,
      amount: Number(updated.amount),
      date: updated.date,
      description: updated.description,
      orderId: updated.orderId,
      order: updated.order,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
    };

    return NextResponse.json({ success: true, expense: formatted, data: formatted });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_EXPENSE_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar despesa." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.expense.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Despesa não encontrada." }, { status: 404 });
    }

    await prisma.expense.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Despesa excluída com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_EXPENSE_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir despesa." }, { status: 500 });
  }
}

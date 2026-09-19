import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { ExpenseSchema, ExpenseFilterSchema } from "@/lib/validators";
import { ExpenseCategory } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const categoryParam = searchParams.get("category");
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const searchParam = searchParams.get("search");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20", 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (categoryParam && categoryParam !== "ALL" && Object.values(ExpenseCategory).includes(categoryParam as ExpenseCategory)) {
      where.category = categoryParam as ExpenseCategory;
    }

    if (startDateParam || endDateParam) {
      where.date = {};
      if (startDateParam) {
        where.date.gte = new Date(startDateParam);
      }
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        where.date.lte = end;
      }
    }

    if (searchParam && searchParam.trim().length > 0) {
      where.OR = [
        { title: { contains: searchParam.trim(), mode: "insensitive" } },
        { description: { contains: searchParam.trim(), mode: "insensitive" } },
      ];
    }

    const [total, expenses, totalSum] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: "desc" },
        include: {
          order: {
            select: { id: true, orderNumber: true },
          },
        },
      }),
      prisma.expense.aggregate({
        where,
        _sum: { amount: true },
      }),
    ]);

    const formattedExpenses = expenses.map((e) => ({
      id: e.id,
      title: e.title,
      category: e.category,
      amount: Number(e.amount),
      date: e.date,
      description: e.description,
      orderId: e.orderId,
      order: e.order,
      createdAt: e.createdAt,
      updatedAt: e.updatedAt,
    }));

    return NextResponse.json({
      success: true,
      data: formattedExpenses,
      summary: {
        totalAmount: Number(totalSum._sum.amount || 0),
      },
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
    console.error("[API_EXPENSES_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar despesas." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

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

    const expense = await prisma.expense.create({
      data: {
        title,
        category: category as ExpenseCategory,
        amount: new Decimal(amount),
        date: date ? new Date(date) : new Date(),
        description: description || null,
        orderId: orderId || null,
      },
      include: {
        order: {
          select: { id: true, orderNumber: true },
        },
      },
    });

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

    return NextResponse.json(
      { success: true, expense: formatted, data: formatted },
      { status: 201 }
    );
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_EXPENSES_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao cadastrar despesa." }, { status: 500 });
  }
}

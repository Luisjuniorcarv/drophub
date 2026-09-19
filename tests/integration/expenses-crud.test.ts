import { describe, it, expect, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { ExpenseCategory } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

describe("ETAPA 6 — Expenses CRUD Integration Tests", () => {
  const createdExpenseIds: string[] = [];

  afterAll(async () => {
    if (createdExpenseIds.length > 0) {
      await prisma.expense.deleteMany({
        where: { id: { in: createdExpenseIds } },
      });
    }
  });

  it("should create an expense with Decimal precision and correct category", async () => {
    const expense = await prisma.expense.create({
      data: {
        title: "Campanha Meta Ads Teste",
        category: ExpenseCategory.MARKETING,
        amount: new Decimal(125.50),
        date: new Date(),
        description: "Anúncio de teste de tráfego pago",
      },
    });

    expect(expense.id).toBeDefined();
    createdExpenseIds.push(expense.id);

    expect(expense.title).toBe("Campanha Meta Ads Teste");
    expect(expense.category).toBe(ExpenseCategory.MARKETING);
    expect(Number(expense.amount)).toBe(125.50);
  });

  it("should query and filter expenses by category and search term", async () => {
    const expenseDomain = await prisma.expense.create({
      data: {
        title: "Renovação Domínio Especial Teste",
        category: ExpenseCategory.DOMAIN,
        amount: new Decimal(55.0),
        date: new Date(),
      },
    });
    createdExpenseIds.push(expenseDomain.id);

    // Filtrar por categoria DOMAIN
    const domainExpenses = await prisma.expense.findMany({
      where: { category: ExpenseCategory.DOMAIN },
    });
    expect(domainExpenses.some((e) => e.id === expenseDomain.id)).toBe(true);

    // Filtrar por busca de texto
    const searchResults = await prisma.expense.findMany({
      where: {
        title: { contains: "Especial Teste", mode: "insensitive" },
      },
    });
    expect(searchResults.length).toBeGreaterThanOrEqual(1);
    expect(searchResults[0].id).toBe(expenseDomain.id);
  });

  it("should update an existing expense correctly", async () => {
    const expense = await prisma.expense.create({
      data: {
        title: "Assinatura Antivirus",
        category: ExpenseCategory.TOOLS,
        amount: new Decimal(39.90),
        date: new Date(),
      },
    });
    createdExpenseIds.push(expense.id);

    const updated = await prisma.expense.update({
      where: { id: expense.id },
      data: {
        title: "Assinatura Suite Segurança",
        amount: new Decimal(49.90),
        description: "Atualizado para plano enterprise",
      },
    });

    expect(updated.title).toBe("Assinatura Suite Segurança");
    expect(Number(updated.amount)).toBe(49.90);
    expect(updated.description).toBe("Atualizado para plano enterprise");
  });

  it("should delete an expense successfully", async () => {
    const expense = await prisma.expense.create({
      data: {
        title: "Despesa Temporária para Exclusão",
        category: ExpenseCategory.OTHER,
        amount: new Decimal(10.0),
        date: new Date(),
      },
    });

    await prisma.expense.delete({ where: { id: expense.id } });

    const check = await prisma.expense.findUnique({ where: { id: expense.id } });
    expect(check).toBeNull();
  });
});

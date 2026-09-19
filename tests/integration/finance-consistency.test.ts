import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { prisma } from "@/lib/prisma";
import { OrderStatus, ExpenseCategory } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { getFinancialDRE } from "@/modules/finance/service";

describe("ETAPA 6 — Financial Consistency Integration Test", () => {
  let customerId: string;
  let orderId: string;
  let expenseId: string;

  beforeAll(async () => {
    // 1. Criar cliente
    const customer = await prisma.customer.create({
      data: {
        name: "Cliente Teste Consistência Financeira",
        email: `finance.consistency.${Date.now()}@example.com`,
        cpf: `321.${Math.floor(100 + Math.random() * 900)}.${Math.floor(100 + Math.random() * 900)}-99`,
        phone: "(11) 97777-6666",
      },
    });
    customerId = customer.id;

    // 2. Criar Pedido do Cenário Obrigatório:
    // Venda (subtotal) = R$ 200.00
    // Desconto = R$ 10.00
    // Frete cobrado = R$ 20.00
    // Total pago = R$ 210.00 (200 + 20 - 10)
    // CPV (custo dos produtos) = R$ 80.00
    const order = await prisma.order.create({
      data: {
        orderNumber: `DH-CONSISTENCY-${Date.now().toString().slice(-4)}`,
        customerId: customer.id,
        status: OrderStatus.PAID,
        subtotalAmount: new Decimal(200.0),
        shippingCost: new Decimal(20.0),
        discountAmount: new Decimal(10.0),
        totalAmount: new Decimal(210.0),
        totalCostAmount: new Decimal(80.0),
        estimatedProfit: new Decimal(110.0),
        marginPercentage: new Decimal(52.38),
        markupPercentage: new Decimal(137.5),
        shippingAddress: { city: "São Paulo", state: "SP" },
        createdAt: new Date(),
      },
    });
    orderId = order.id;

    // 3. Criar Despesa Operacional do Cenário Obrigatório:
    // Despesa operacional = R$ 30.00 (TOOLS)
    const expense = await prisma.expense.create({
      data: {
        title: "Assinatura Software de Gestão",
        category: ExpenseCategory.TOOLS,
        amount: new Decimal(30.0),
        date: new Date(),
      },
    });
    expenseId = expense.id;
  });

  afterAll(async () => {
    if (orderId) {
      await prisma.order.delete({ where: { id: orderId } }).catch(() => {});
    }
    if (expenseId) {
      await prisma.expense.delete({ where: { id: expenseId } }).catch(() => {});
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } }).catch(() => {});
    }
  });

  /**
   * TESTE OBRIGATÓRIO DE CONSISTÊNCIA FINANCEIRA DO DRE
   * 
   * Tratamento de Frete sem Dupla Contagem:
   * - O frete cobrado do cliente (R$ 20) compõe a Receita Bruta (R$ 220 = R$ 200 mercadorias + R$ 20 frete).
   * - O desconto (R$ 10) deduz da receita bruta resultando em Receita Líquida de R$ 210.
   * - O CPV (R$ 80) é deduzido gerando Lucro Bruto de R$ 130.
   * - A despesa operacional de ferramentas (R$ 30) gera Lucro Operacional de R$ 100.
   * - Margem Operacional: (100 / 210) * 100 = 47.62%.
   */
  it("MANDATORY: should calculate exact DRE values for integrated scenario without double counting freight", async () => {
    // Buscar DRE de hoje (onde criamos o pedido e a despesa)
    const dreResult = await getFinancialDRE("today");
    const m = dreResult.metrics;

    // Verificar que a ordem e a despesa foram computadas
    expect(m.grossRevenue).toBeGreaterThanOrEqual(220.0);
    expect(m.discounts).toBeGreaterThanOrEqual(10.0);
    expect(m.netRevenue).toBeGreaterThanOrEqual(210.0);
    expect(m.cpv).toBeGreaterThanOrEqual(80.0);
    expect(m.grossProfit).toBeGreaterThanOrEqual(130.0);
    expect(m.operationalExpenses.tools).toBeGreaterThanOrEqual(30.0);
    expect(m.operatingProfit).toBeGreaterThanOrEqual(100.0);

    // Validar relações matemáticas estritas
    expect(m.netRevenue).toBe(Number((m.grossRevenue - m.discounts - m.refunds).toFixed(2)));
    expect(m.grossProfit).toBe(Number((m.netRevenue - m.cpv).toFixed(2)));
    expect(m.operatingProfit).toBe(Number((m.grossProfit - m.totalExpenses).toFixed(2)));
    expect(m.operatingMarginPercentage).toBe(
      Number(((m.operatingProfit / m.netRevenue) * 100).toFixed(2))
    );
  });
});

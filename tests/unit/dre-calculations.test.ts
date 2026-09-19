import { describe, it, expect } from "vitest";
import { OrderStatus, ExpenseCategory } from "@prisma/client";
import { calculateDREMetrics } from "@/modules/finance/service";

describe("ETAPA 6 — DRE Mathematical Formulas & Financial Calculations", () => {
  it("should calculate DRE accurately with standard sales, CPV and expenses", () => {
    // Pedido 1: Venda R$ 100, Desconto R$ 0, Frete R$ 10, Total R$ 110, Custo R$ 40
    // Pedido 2: Venda R$ 200, Desconto R$ 20, Frete R$ 15, Total R$ 195, Custo R$ 80
    const orders = [
      {
        id: "o1",
        status: OrderStatus.DELIVERED,
        totalAmount: 110.0,
        subtotalAmount: 100.0,
        discountAmount: 0.0,
        shippingCost: 10.0,
        totalCostAmount: 40.0,
        createdAt: new Date(),
      },
      {
        id: "o2",
        status: OrderStatus.PAID,
        totalAmount: 195.0,
        subtotalAmount: 200.0,
        discountAmount: 20.0,
        shippingCost: 15.0,
        totalCostAmount: 80.0,
        createdAt: new Date(),
      },
    ];

    // Despesas: Marketing R$ 30, Servidor R$ 20
    const expenses = [
      { id: "e1", category: ExpenseCategory.MARKETING, amount: 30.0, date: new Date() },
      { id: "e2", category: ExpenseCategory.TOOLS, amount: 20.0, date: new Date() },
    ];

    const dre = calculateDREMetrics({ orders, expenses });

    // Receita Bruta = (110 + 0) + (195 + 20) = 110 + 215 = 325.00
    expect(dre.grossRevenue).toBe(325.0);
    // Descontos = 0 + 20 = 20.00
    expect(dre.discounts).toBe(20.0);
    // Reembolsos = 0
    expect(dre.refunds).toBe(0.0);
    // Receita Líquida = 325 - 20 - 0 = 305.00
    expect(dre.netRevenue).toBe(305.0);
    // CPV = 40 + 80 = 120.00
    expect(dre.cpv).toBe(120.0);
    // Lucro Bruto = 305 - 120 = 185.00
    expect(dre.grossProfit).toBe(185.0);
    // Margem Bruta = (185 / 305) * 100 = 60.66%
    expect(dre.grossMarginPercentage).toBe(60.66);

    // Despesas Variáveis = 30.00 (Marketing)
    expect(dre.variableExpenses.total).toBe(30.0);
    expect(dre.variableExpenses.marketingAds).toBe(30.0);
    // Despesas Operacionais = 20.00 (Tools)
    expect(dre.operationalExpenses.total).toBe(20.0);
    expect(dre.operationalExpenses.tools).toBe(20.0);
    // Total de Despesas = 50.00
    expect(dre.totalExpenses).toBe(50.0);

    // Lucro Operacional = 185 - 50 = 135.00
    expect(dre.operatingProfit).toBe(135.0);
    // Margem Operacional = (135 / 305) * 100 = 44.26%
    expect(dre.operatingMarginPercentage).toBe(44.26);
    expect(dre.ordersCount).toBe(2);
  });

  it("should handle period with zero sales without division-by-zero errors", () => {
    const orders: any[] = [];
    const expenses = [
      { id: "e1", category: ExpenseCategory.DOMAIN, amount: 40.0, date: new Date() },
    ];

    const dre = calculateDREMetrics({ orders, expenses });

    expect(dre.grossRevenue).toBe(0.0);
    expect(dre.netRevenue).toBe(0.0);
    expect(dre.cpv).toBe(0.0);
    expect(dre.grossProfit).toBe(0.0);
    expect(dre.grossMarginPercentage).toBe(0.0);
    expect(dre.totalExpenses).toBe(40.0);
    expect(dre.operatingProfit).toBe(-40.0);
    expect(dre.operatingMarginPercentage).toBe(0.0);
    expect(dre.ordersCount).toBe(0);
    expect(dre.averageTicket).toBe(0.0);
  });

  it("should ignore CANCELLED and AWAITING_PAYMENT orders from realized DRE calculations", () => {
    const orders = [
      {
        id: "o-cancelled",
        status: OrderStatus.CANCELLED,
        totalAmount: 500.0,
        subtotalAmount: 500.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 200.0,
        createdAt: new Date(),
      },
      {
        id: "o-awaiting",
        status: OrderStatus.AWAITING_PAYMENT,
        totalAmount: 300.0,
        subtotalAmount: 300.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 100.0,
        createdAt: new Date(),
      },
      {
        id: "o-paid",
        status: OrderStatus.PAID,
        totalAmount: 100.0,
        subtotalAmount: 100.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 40.0,
        createdAt: new Date(),
      },
    ];

    const dre = calculateDREMetrics({ orders, expenses: [] });

    // Apenas o pedido PAID (100) deve entrar
    expect(dre.grossRevenue).toBe(100.0);
    expect(dre.netRevenue).toBe(100.0);
    expect(dre.cpv).toBe(40.0);
    expect(dre.grossProfit).toBe(60.0);
    expect(dre.operatingProfit).toBe(60.0);
    expect(dre.ordersCount).toBe(1);
  });

  it("should deduct REFUNDED orders from net revenue explicitly", () => {
    const orders = [
      {
        id: "o-paid",
        status: OrderStatus.DELIVERED,
        totalAmount: 150.0,
        subtotalAmount: 150.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 50.0,
        createdAt: new Date(),
      },
      {
        id: "o-refunded",
        status: OrderStatus.REFUNDED,
        totalAmount: 50.0,
        subtotalAmount: 50.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 20.0,
        createdAt: new Date(),
      },
    ];

    const dre = calculateDREMetrics({ orders, expenses: [] });

    expect(dre.grossRevenue).toBe(200.0);
    expect(dre.refunds).toBe(50.0);
    expect(dre.netRevenue).toBe(150.0); // 200 - 50
    expect(dre.cpv).toBe(50.0); // CPV do pedido entregue (o reembolsado não consome CPV final)
    expect(dre.grossProfit).toBe(100.0);
    expect(dre.operatingProfit).toBe(100.0);
  });

  it("should calculate operating loss (negative profit) correctly when expenses exceed revenue", () => {
    const orders = [
      {
        id: "o1",
        status: OrderStatus.PAID,
        totalAmount: 100.0,
        subtotalAmount: 100.0,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 60.0,
        createdAt: new Date(),
      },
    ];

    const expenses = [
      { id: "e1", category: ExpenseCategory.MARKETING, amount: 150.0, date: new Date() },
    ];

    const dre = calculateDREMetrics({ orders, expenses });

    // Lucro Bruto = 100 - 60 = 40
    expect(dre.grossProfit).toBe(40.0);
    // Lucro Operacional = 40 - 150 = -110 (Prejuízo)
    expect(dre.operatingProfit).toBe(-110.0);
    // Margem Operacional = (-110 / 100) * 100 = -110%
    expect(dre.operatingMarginPercentage).toBe(-110.0);
  });

  it("should preserve exact cent precision with Decimal numbers", () => {
    const orders = [
      {
        id: "o1",
        status: OrderStatus.PAID,
        totalAmount: 33.33,
        subtotalAmount: 33.33,
        discountAmount: 0.0,
        shippingCost: 0.0,
        totalCostAmount: 11.11,
        createdAt: new Date(),
      },
    ];

    const expenses = [
      { id: "e1", category: ExpenseCategory.TOOLS, amount: 7.77, date: new Date() },
    ];

    const dre = calculateDREMetrics({ orders, expenses });

    expect(dre.grossRevenue).toBe(33.33);
    expect(dre.cpv).toBe(11.11);
    expect(dre.grossProfit).toBe(22.22);
    expect(dre.totalExpenses).toBe(7.77);
    expect(dre.operatingProfit).toBe(14.45); // 22.22 - 7.77 = 14.45
  });
});

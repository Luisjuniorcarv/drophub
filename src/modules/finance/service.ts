import { prisma } from "@/lib/prisma";
import { OrderStatus, ExpenseCategory, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import {
  PeriodType,
  DateRange,
  DREStatement,
  CashFlowStatement,
  CashFlowEntry,
  DailyFinancialItem,
} from "./types";

/**
 * Resolve datas de início e fim com base no período solicitado
 */
export function resolveDateRange(
  period: PeriodType = "30d",
  customStart?: string | null,
  customEnd?: string | null
): DateRange {
  const now = new Date();
  let startDate: Date;
  let endDate = new Date(now);
  endDate.setHours(23, 59, 59, 999);
  let label = "Últimos 30 dias";

  switch (period) {
    case "today": {
      startDate = new Date(now);
      startDate.setHours(0, 0, 0, 0);
      label = "Hoje";
      break;
    }
    case "7d": {
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      label = "Últimos 7 dias";
      break;
    }
    case "month": {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      startDate.setHours(0, 0, 0, 0);
      label = "Mês Atual";
      break;
    }
    case "last_month": {
      startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      startDate.setHours(0, 0, 0, 0);
      endDate = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      label = "Mês Anterior";
      break;
    }
    case "custom": {
      if (customStart && customEnd) {
        startDate = new Date(customStart);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(customEnd);
        endDate.setHours(23, 59, 59, 999);
        label = `De ${startDate.toLocaleDateString("pt-BR")} até ${endDate.toLocaleDateString("pt-BR")}`;
      } else {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        label = "Personalizado (Padrão 30d)";
      }
      break;
    }
    case "30d":
    default: {
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      startDate.setHours(0, 0, 0, 0);
      label = "Últimos 30 dias";
      break;
    }
  }

  return { startDate, endDate, label };
}

/**
 * Função pura para cálculo matemático exato de DRE usando Decimals
 */
export function calculateDREMetrics(params: {
  orders: Array<{
    id: string;
    status: OrderStatus;
    totalAmount: number | Decimal;
    subtotalAmount: number | Decimal;
    discountAmount: number | Decimal;
    shippingCost: number | Decimal;
    totalCostAmount: number | Decimal;
    createdAt: Date;
  }>;
  expenses: Array<{
    id: string;
    category: ExpenseCategory;
    amount: number | Decimal;
    date: Date;
  }>;
}) {
  const { orders, expenses } = params;

  // 1. Filtragem por Status
  // CANCELLED não entra em vendas realizadas
  // AWAITING_PAYMENT não entra como realizado
  // REFUNDED entra para dedução explícita de reembolso
  const validRealizedOrders = orders.filter((o) =>
    ([
      OrderStatus.PAID,
      OrderStatus.PROCESSING,
      OrderStatus.AWAITING_SUPPLIER,
      OrderStatus.SENT_TO_SUPPLIER,
      OrderStatus.SHIPPED,
      OrderStatus.DELIVERED,
      OrderStatus.REFUNDED,
    ] as OrderStatus[]).includes(o.status)
  );

  const refundedOrders = orders.filter((o) => o.status === OrderStatus.REFUNDED);

  // 2. Acumulação em Decimal para precisão absoluta
  let decGrossRevenue = new Decimal(0);
  let decDiscounts = new Decimal(0);
  let decRefunds = new Decimal(0);
  let decCPV = new Decimal(0);

  validRealizedOrders.forEach((o) => {
    // Se o pedido não foi cancelado:
    // Receita Bruta = subtotal + frete cobrado
    // (ou totalAmount + discountAmount antes do desconto)
    const orderTotal = new Decimal(o.totalAmount.toString());
    const orderDiscount = new Decimal(o.discountAmount.toString());
    const orderCost = new Decimal(o.totalCostAmount.toString());

    decGrossRevenue = decGrossRevenue.plus(orderTotal.plus(orderDiscount));
    decDiscounts = decDiscounts.plus(orderDiscount);

    if (o.status !== OrderStatus.REFUNDED) {
      decCPV = decCPV.plus(orderCost);
    }
  });

  // Reembolsos
  refundedOrders.forEach((o) => {
    const refundTotal = new Decimal(o.totalAmount.toString());
    decRefunds = decRefunds.plus(refundTotal);
  });

  // Também somar despesas cadastradas na categoria REFUND se houverem
  expenses
    .filter((e) => e.category === ExpenseCategory.REFUND)
    .forEach((e) => {
      decRefunds = decRefunds.plus(new Decimal(e.amount.toString()));
    });

  // Receita Líquida = Receita Bruta - Descontos - Reembolsos
  const decNetRevenue = Decimal.max(0, decGrossRevenue.minus(decDiscounts).minus(decRefunds));

  // Lucro Bruto = Receita Líquida - CPV
  const decGrossProfit = decNetRevenue.minus(decCPV);

  // Margem Bruta = Lucro Bruto / Receita Líquida * 100
  const grossMarginPercentage = decNetRevenue.greaterThan(0)
    ? decGrossProfit.dividedBy(decNetRevenue).times(100).toNumber()
    : 0;

  // 3. Despesas Variáveis e Operacionais
  let decMarketingAds = new Decimal(0);
  let decLogisticsExtra = new Decimal(0);
  let decTaxes = new Decimal(0);
  let decGatewayFees = new Decimal(0);

  let decTools = new Decimal(0);
  let decDomain = new Decimal(0);
  let decOther = new Decimal(0);

  expenses.forEach((e) => {
    const amt = new Decimal(e.amount.toString());
    switch (e.category) {
      case ExpenseCategory.MARKETING:
        decMarketingAds = decMarketingAds.plus(amt);
        break;
      case ExpenseCategory.LOGISTICS:
        decLogisticsExtra = decLogisticsExtra.plus(amt);
        break;
      case ExpenseCategory.TAXES:
        decTaxes = decTaxes.plus(amt);
        break;
      case ExpenseCategory.TOOLS:
        decTools = decTools.plus(amt);
        break;
      case ExpenseCategory.DOMAIN:
        decDomain = decDomain.plus(amt);
        break;
      case ExpenseCategory.OTHER:
        decOther = decOther.plus(amt);
        break;
      case ExpenseCategory.REFUND:
        // Já computado acima em decRefunds
        break;
    }
  });

  const decTotalVariableExpenses = decMarketingAds
    .plus(decLogisticsExtra)
    .plus(decTaxes)
    .plus(decGatewayFees);

  const decTotalOperationalExpenses = decTools.plus(decDomain).plus(decOther);
  const decTotalExpenses = decTotalVariableExpenses.plus(decTotalOperationalExpenses);

  // 4. Lucro Operacional = Lucro Bruto - Despesas
  const decOperatingProfit = decGrossProfit.minus(decTotalExpenses);

  // Margem Operacional = Lucro Operacional / Receita Líquida * 100
  const operatingMarginPercentage = decNetRevenue.greaterThan(0)
    ? decOperatingProfit.dividedBy(decNetRevenue).times(100).toNumber()
    : 0;

  const validCompletedOrders = validRealizedOrders.filter(
    (o) => o.status !== OrderStatus.REFUNDED
  );
  const ordersCount = validCompletedOrders.length;
  const averageTicket =
    ordersCount > 0 ? decGrossRevenue.dividedBy(ordersCount).toNumber() : 0;

  return {
    grossRevenue: Number(decGrossRevenue.toFixed(2)),
    discounts: Number(decDiscounts.toFixed(2)),
    refunds: Number(decRefunds.toFixed(2)),
    netRevenue: Number(decNetRevenue.toFixed(2)),
    cpv: Number(decCPV.toFixed(2)),
    grossProfit: Number(decGrossProfit.toFixed(2)),
    grossMarginPercentage: Number(grossMarginPercentage.toFixed(2)),
    variableExpenses: {
      total: Number(decTotalVariableExpenses.toFixed(2)),
      marketingAds: Number(decMarketingAds.toFixed(2)),
      logisticsExtra: Number(decLogisticsExtra.toFixed(2)),
      taxes: Number(decTaxes.toFixed(2)),
      gatewayFees: Number(decGatewayFees.toFixed(2)),
    },
    operationalExpenses: {
      total: Number(decTotalOperationalExpenses.toFixed(2)),
      tools: Number(decTools.toFixed(2)),
      domain: Number(decDomain.toFixed(2)),
      other: Number(decOther.toFixed(2)),
    },
    totalExpenses: Number(decTotalExpenses.toFixed(2)),
    operatingProfit: Number(decOperatingProfit.toFixed(2)),
    operatingMarginPercentage: Number(operatingMarginPercentage.toFixed(2)),
    ordersCount,
    averageTicket: Number(averageTicket.toFixed(2)),
  };
}

/**
 * Consulta o DRE Consolidado com base no período solicitado
 */
export async function getFinancialDRE(
  period: PeriodType = "30d",
  customStart?: string | null,
  customEnd?: string | null
): Promise<DREStatement> {
  const { startDate, endDate, label } = resolveDateRange(period, customStart, customEnd);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        subtotalAmount: true,
        discountAmount: true,
        shippingCost: true,
        totalCostAmount: true,
        createdAt: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        category: true,
        amount: true,
        date: true,
      },
    }),
  ]);

  const metrics = calculateDREMetrics({ orders, expenses });

  return {
    period: {
      type: period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label,
    },
    metrics,
  };
}

/**
 * Consulta e formata o Fluxo de Caixa do período
 */
export async function getCashFlow(
  period: PeriodType = "30d",
  customStart?: string | null,
  customEnd?: string | null
): Promise<CashFlowStatement> {
  const { startDate, endDate, label } = resolveDateRange(period, customStart, customEnd);

  const [payments, expenses] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: PaymentStatus.APPROVED,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        order: {
          select: { orderNumber: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { date: "desc" },
    }),
  ]);

  const entries: CashFlowEntry[] = [];
  let decTotalInflow = new Decimal(0);
  let decTotalOutflow = new Decimal(0);

  // Inflows (Entradas)
  payments.forEach((p) => {
    const amt = new Decimal(p.amount.toString());
    decTotalInflow = decTotalInflow.plus(amt);
    entries.push({
      id: p.id,
      date: p.paidAt?.toISOString() || p.createdAt.toISOString(),
      type: "INFLOW",
      category: `Recebimento (${p.method})`,
      description: `Pagamento do Pedido ${p.order?.orderNumber || "DH"}`,
      amount: Number(amt.toFixed(2)),
      referenceId: p.orderId,
    });
  });

  // Outflows (Saídas de Despesas)
  expenses.forEach((e) => {
    const amt = new Decimal(e.amount.toString());
    decTotalOutflow = decTotalOutflow.plus(amt);
    entries.push({
      id: e.id,
      date: e.date.toISOString(),
      type: "OUTFLOW",
      category: `Despesa (${e.category})`,
      description: e.title,
      amount: Number(amt.toFixed(2)),
      referenceId: e.id,
    });
  });

  // Ordenar cronologicamente decrescente
  entries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const decNetBalance = decTotalInflow.minus(decTotalOutflow);

  return {
    period: {
      type: period,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      label,
    },
    totalInflow: Number(decTotalInflow.toFixed(2)),
    totalOutflow: Number(decTotalOutflow.toFixed(2)),
    netCashBalance: Number(decNetBalance.toFixed(2)),
    entries,
  };
}

/**
 * Agrupamento diário de receitas, custos, despesas e lucros no período
 */
export async function getDailyFinancialSeries(
  period: PeriodType = "30d",
  customStart?: string | null,
  customEnd?: string | null
): Promise<DailyFinancialItem[]> {
  const { startDate, endDate } = resolveDateRange(period, customStart, customEnd);

  const [orders, expenses] = await Promise.all([
    prisma.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        status: true,
        totalAmount: true,
        subtotalAmount: true,
        discountAmount: true,
        shippingCost: true,
        totalCostAmount: true,
        createdAt: true,
      },
    }),
    prisma.expense.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        category: true,
        amount: true,
        date: true,
      },
    }),
  ]);

  // Agrupar por data (YYYY-MM-DD)
  const mapDaily = new Map<string, { orders: typeof orders; expenses: typeof expenses }>();

  // Inicializar dias no intervalo
  const curr = new Date(startDate);
  while (curr <= endDate) {
    const key = curr.toISOString().split("T")[0];
    mapDaily.set(key, { orders: [], expenses: [] });
    curr.setDate(curr.getDate() + 1);
  }

  // Preencher pedidos
  orders.forEach((o) => {
    const key = o.createdAt.toISOString().split("T")[0];
    if (!mapDaily.has(key)) {
      mapDaily.set(key, { orders: [], expenses: [] });
    }
    mapDaily.get(key)!.orders.push(o);
  });

  // Preencher despesas
  expenses.forEach((e) => {
    const key = e.date.toISOString().split("T")[0];
    if (!mapDaily.has(key)) {
      mapDaily.set(key, { orders: [], expenses: [] });
    }
    mapDaily.get(key)!.expenses.push(e);
  });

  const result: DailyFinancialItem[] = [];

  Array.from(mapDaily.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([dateKey, data]) => {
      const dre = calculateDREMetrics({ orders: data.orders, expenses: data.expenses });
      const [year, month, day] = dateKey.split("-");
      result.push({
        date: dateKey,
        formattedDate: `${day}/${month}`,
        grossRevenue: dre.grossRevenue,
        discounts: dre.discounts,
        refunds: dre.refunds,
        netRevenue: dre.netRevenue,
        cpv: dre.cpv,
        expenses: dre.totalExpenses,
        profit: dre.operatingProfit,
        ordersCount: dre.ordersCount,
      });
    });

  return result;
}

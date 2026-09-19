import { ExpenseCategory } from "@prisma/client";

export type PeriodType = "today" | "7d" | "30d" | "month" | "last_month" | "custom";

export interface DateRange {
  startDate: Date;
  endDate: Date;
  label: string;
}

export interface DREStatement {
  period: {
    type: PeriodType;
    startDate: string;
    endDate: string;
    label: string;
  };
  metrics: {
    // 1. Receita
    grossRevenue: number;          // Receita Bruta (vendas de pedidos válidos + frete cobrado)
    discounts: number;             // (-) Descontos concedidos
    refunds: number;               // (-) Reembolsos
    netRevenue: number;            // (=) Receita Líquida (Receita Bruta - Descontos - Reembolsos)

    // 2. Custos Diretos
    cpv: number;                   // (-) Custo dos Produtos Vendidos (snapshot totalCostAmount)
    grossProfit: number;           // (=) Lucro Bruto (Receita Líquida - CPV)
    grossMarginPercentage: number; // Margem Bruta (%) (Lucro Bruto / Receita Líquida * 100)

    // 3. Despesas
    variableExpenses: {
      total: number;
      marketingAds: number;        // Despesas de MARKETING
      logisticsExtra: number;      // Despesas de LOGISTICS
      taxes: number;               // Despesas de TAXES
      gatewayFees: number;         // Taxas financeiras registradas
    };
    operationalExpenses: {
      total: number;
      tools: number;               // Ferramentas / Software / SaaS
      domain: number;              // Domínios / Hospedagem
      other: number;               // Outras despesas fixas/administrativas
    };
    totalExpenses: number;         // Soma de todas as despesas variáveis e fixas

    // 4. Resultado Operacional
    operatingProfit: number;       // (=) Lucro Operacional (Lucro Bruto - Despesas)
    operatingMarginPercentage: number; // Margem Operacional (%) (Lucro Operacional / Receita Líquida * 100)
    
    // Contagens
    ordersCount: number;           // Quantidade de pedidos considerados
    averageTicket: number;         // Ticket Médio (Receita Bruta / Quantidade de pedidos)
  };
}

export interface CashFlowEntry {
  id: string;
  date: string;
  type: "INFLOW" | "OUTFLOW";
  category: string;
  description: string;
  amount: number;
  referenceId?: string; // orderId ou expenseId
}

export interface CashFlowStatement {
  period: {
    type: PeriodType;
    startDate: string;
    endDate: string;
    label: string;
  };
  totalInflow: number;     // Total de Entradas (pagamentos confirmados)
  totalOutflow: number;    // Total de Saídas (despesas pagas + custos de produtos despachados)
  netCashBalance: number;  // Saldo Líquido de Caixa (Entradas - Saídas)
  entries: CashFlowEntry[];
}

export interface DailyFinancialItem {
  date: string;            // "YYYY-MM-DD"
  formattedDate: string;   // "DD/MM"
  grossRevenue: number;
  discounts: number;
  refunds: number;
  netRevenue: number;
  cpv: number;
  expenses: number;
  profit: number;
  ordersCount: number;
}

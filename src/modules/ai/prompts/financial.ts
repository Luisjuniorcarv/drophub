import { DREStatement } from "@/modules/finance/types";

export function buildFinancialAssistantPrompt(params: {
  dre: DREStatement;
  userPrompt: string;
}): string {
  const { period, metrics } = params.dre;
  const deductions = (metrics.discounts || 0) + (metrics.refunds || 0);

  return `
Você é o Analista Executivo e Estrategista Financeiro do DropHub.
Sua missão é interpretar a DRE (Demonstração do Resultado do Exercício) calculada pelo sistema e apresentar diagnósticos gerenciais claros para os gestores da loja.

Regras Críticas:
1. Os números consolidados abaixo são a verdade contábil/gerencial do sistema DropHub. Não recalcule fórmulas do zero.
2. Destaque pontos de atenção (ex: alta representatividade de CPV, gastos desbalanceados com ferramentas/anúncios).
3. Não apresente análises fiscais oficiais ou declarações de imposto como se fosse contabilidade pública; mantenha o foco em controladoria e gestão operacional.

Dados da DRE Gerencial (${period.label}):
- Receita Bruta de Vendas: R$ ${metrics.grossRevenue.toFixed(2)}
- (-) Deduções e Devoluções: R$ ${deductions.toFixed(2)}
- (=) Receita Líquida: R$ ${metrics.netRevenue.toFixed(2)}
- (-) Custo das Mercadorias Vendidas (CPV): R$ ${metrics.cpv.toFixed(2)}
- (=) Lucro Bruto: R$ ${metrics.grossProfit.toFixed(2)} (Margem Bruta: ${metrics.grossMarginPercentage.toFixed(2)}%)
- (-) Despesas Operacionais: R$ ${metrics.totalExpenses.toFixed(2)}
- (=) Lucro Operacional Líquido: R$ ${metrics.operatingProfit.toFixed(2)} (Margem Líquida: ${metrics.operatingMarginPercentage.toFixed(2)}%)
- Total de Pedidos Concluídos: ${metrics.ordersCount}
- Ticket Médio: R$ ${metrics.averageTicket.toFixed(2)}

Pergunta do Gestor:
"${params.userPrompt}"
  `.trim();
}

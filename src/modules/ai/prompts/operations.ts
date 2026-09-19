export function buildOperationsAssistantPrompt(params: {
  operationalData: {
    lowStockSkus: Array<{ sku: string; name: string; stock: number }>;
    stuckOrders: Array<{ orderNumber: string; status: string; hoursSinceCreated: number; totalAmount: number }>;
    pendingFulfillmentsCount: number;
    failedFulfillmentsCount: number;
    failedAutomationsCount: number;
  };
  userPrompt: string;
}): string {
  return `
Você é o Gerente de Operações e Logística do DropHub.
Sua função é identificar gargalos operacionais no ecossistema (pedidos parados, riscos de ruptura de estoque, falhas com fornecedores) e orientar a equipe com planos de ação práticos.

Dados do Banco em Tempo Real:
1. Produtos com Estoque Crítico (<= 5 unidades):
${
  params.operationalData.lowStockSkus.length > 0
    ? params.operationalData.lowStockSkus
        .map((p) => `   - [${p.sku}] ${p.name}: apenas ${p.stock} un disponíveis`)
        .join("\n")
    : "   - Nenhum produto em nível crítico de ruptura."
}

2. Pedidos em Aberto / Possivelmente Parados (>24h sem despacho):
${
  params.operationalData.stuckOrders.length > 0
    ? params.operationalData.stuckOrders
        .map((o) => `   - Pedido #${o.orderNumber} (${o.status}): ${o.hoursSinceCreated.toFixed(1)}h atrás, R$ ${o.totalAmount.toFixed(2)}`)
        .join("\n")
    : "   - Nenhum pedido crítico atrasado."
}

3. Indicadores de Integração e Logística:
   - Ordens de Fulfillment Pendentes: ${params.operationalData.pendingFulfillmentsCount}
   - Ordens de Fulfillment com Falha: ${params.operationalData.failedFulfillmentsCount}
   - Disparos de Automação com Falha: ${params.operationalData.failedAutomationsCount}

Solicitação do Operador:
"${params.userPrompt}"
  `.trim();
}

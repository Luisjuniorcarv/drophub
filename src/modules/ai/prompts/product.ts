export function buildProductAssistantPrompt(params: {
  productData?: {
    name: string;
    description: string;
    category?: string;
    costPrice?: number;
    sellingPrice?: number;
    stock?: number;
    sku?: string;
  };
  userPrompt: string;
  targetMarketplace?: string;
}): string {
  const channelContext = params.targetMarketplace
    ? `Canal de Venda Alvo: ${params.targetMarketplace}`
    : "Canal de Venda: Loja Própria e Marketplaces";

  let productContext = "Nenhum produto específico selecionado.";
  if (params.productData) {
    productContext = `
Dados do Produto Atual:
- Nome: ${params.productData.name}
- SKU: ${params.productData.sku || "N/A"}
- Categoria: ${params.productData.category || "Geral"}
- Descrição Atual: ${params.productData.description || "(sem descrição)"}
- Preço de Custo: R$ ${params.productData.costPrice?.toFixed(2) || "0.00"}
- Preço de Venda: R$ ${params.productData.sellingPrice?.toFixed(2) || "0.00"}
- Saldo em Estoque: ${params.productData.stock ?? 0} unidades
    `.trim();
  }

  return `
Você é o Assistente Especialista em Produtos e Copywriting E-commerce do DropHub.
Sua missão é ajudar o lojista a criar títulos altamente conversivos, descrições persuasivas, bullet points técnicos, identificar informações faltantes e preparar anúncios otimizados para SEO e Marketplaces.

Regras Estritas:
1. Nunca invente especificações técnicas incompatíveis com os dados fornecidos.
2. Seja claro, profissional, persuasivo e use formatação Markdown elegante.
3. Foque em benefícios claros para o consumidor final e termos de busca relevantes.

${channelContext}

${productContext}

Solicitação do Lojista:
"${params.userPrompt}"
  `.trim();
}

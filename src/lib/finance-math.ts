/**
 * Cálculos Financeiros e Fórmulas de Precificação do DropHub
 * 
 * MARGEM x MARKUP:
 * - Margem (% sobre a venda): (Lucro / Preço de Venda) * 100
 * - Markup (% sobre o custo): (Lucro / Custo Total) * 100
 * 
 * FÓRMULAS DE CUSTO TOTAL:
 * custo_total = custo_produto + frete + taxa_gateway + impostos + custo_anuncio + outros_custos
 */

export interface CostBreakdown {
  productCost: number;     // Custo do produto pago ao fornecedor
  shippingCost?: number;   // Frete internacional ou nacional
  gatewayFee?: number;     // Taxa de processamento de pagamento
  taxes?: number;          // Impostos (ex: DAS Simples)
  adSpend?: number;        // Custo estimado por aquisição (CPA / Ads)
  otherCosts?: number;     // Outros custos diretos
}

export interface AdvancedPricingCalculation {
  productCost: number;
  totalCost: number;
  sellingPrice: number;
  profit: number;
  marginPercentage: number;
  markupPercentage: number;
  markupMultiplier: number;
  isProfitable: boolean;
}

/**
 * Calcula o custo total somando todos os custos diretos do produto
 */
export function calculateTotalCost(costs: CostBreakdown): number {
  const productCost = Math.max(0, Number(costs.productCost) || 0);
  const shippingCost = Math.max(0, Number(costs.shippingCost) || 0);
  const gatewayFee = Math.max(0, Number(costs.gatewayFee) || 0);
  const taxes = Math.max(0, Number(costs.taxes) || 0);
  const adSpend = Math.max(0, Number(costs.adSpend) || 0);
  const otherCosts = Math.max(0, Number(costs.otherCosts) || 0);

  const total = productCost + shippingCost + gatewayFee + taxes + adSpend + otherCosts;
  return Number(total.toFixed(2));
}

/**
 * Calcula todas as métricas financeiras a partir do custo e preço de venda
 */
export function calculatePricingMetrics(
  costPrice: number,
  sellingPrice: number
): AdvancedPricingCalculation {
  const cost = Math.max(0, Number(costPrice) || 0);
  const selling = Math.max(0, Number(sellingPrice) || 0);
  const profit = Number((selling - cost).toFixed(2));

  // Margem (%): (Lucro / Preço de Venda) * 100
  const marginPercentage =
    selling > 0 ? Number(((profit / selling) * 100).toFixed(2)) : 0;

  // Markup (%): (Lucro / Custo Total) * 100
  const markupPercentage =
    cost > 0 ? Number(((profit / cost) * 100).toFixed(2)) : 0;

  // Multiplicador de Markup: Preço de Venda / Custo Total
  const markupMultiplier = cost > 0 ? Number((selling / cost).toFixed(2)) : 0;

  return {
    productCost: cost,
    totalCost: cost,
    sellingPrice: selling,
    profit,
    marginPercentage,
    markupPercentage,
    markupMultiplier,
    isProfitable: profit > 0,
  };
}

/**
 * Calcula métricas com detalhamento completo de custos
 */
export function calculateAdvancedPricing(
  costs: CostBreakdown,
  sellingPrice: number
): AdvancedPricingCalculation {
  const totalCost = calculateTotalCost(costs);
  const selling = Math.max(0, Number(sellingPrice) || 0);
  const profit = Number((selling - totalCost).toFixed(2));

  const marginPercentage =
    selling > 0 ? Number(((profit / selling) * 100).toFixed(2)) : 0;

  const markupPercentage =
    totalCost > 0 ? Number(((profit / totalCost) * 100).toFixed(2)) : 0;

  const markupMultiplier = totalCost > 0 ? Number((selling / totalCost).toFixed(2)) : 0;

  return {
    productCost: Number(costs.productCost) || 0,
    totalCost,
    sellingPrice: selling,
    profit,
    marginPercentage,
    markupPercentage,
    markupMultiplier,
    isProfitable: profit > 0,
  };
}

/**
 * CÁLCULO REVERSO POR MARGEM DESEJADA:
 * Preço de Venda = Custo Total / (1 - (Margem Desejada / 100))
 * 
 * Ex: Custo Total = R$ 50, Margem Desejada = 50% -> Preço de Venda = 50 / 0.5 = R$ 100
 */
export function calculatePriceFromMargin(
  totalCost: number,
  targetMarginPercentage: number
): number {
  const cost = Math.max(0, Number(totalCost) || 0);
  const margin = Number(targetMarginPercentage) || 0;

  if (cost <= 0) return 0;
  if (margin <= 0) return cost;
  if (margin >= 100) return 0; // Evita divisão por zero ou infinito

  const decimalMargin = margin / 100;
  const price = cost / (1 - decimalMargin);
  return Number(price.toFixed(2));
}

/**
 * CÁLCULO REVERSO POR MARKUP DESEJADO:
 * Preço de Venda = Custo Total * (1 + (Markup Desejado / 100))
 * 
 * Ex: Custo Total = R$ 50, Markup Desejado = 100% -> Preço de Venda = 50 * 2 = R$ 100
 */
export function calculatePriceFromMarkup(
  totalCost: number,
  targetMarkupPercentage: number
): number {
  const cost = Math.max(0, Number(totalCost) || 0);
  const markup = Number(targetMarkupPercentage) || 0;

  if (cost <= 0) return 0;
  if (markup < 0) return cost;

  const price = cost * (1 + markup / 100);
  return Number(price.toFixed(2));
}

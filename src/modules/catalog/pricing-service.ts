import {
  calculatePriceFromMargin,
  calculatePriceFromMarkup,
  calculateAdvancedPricing,
  calculatePricingMetrics,
  CostBreakdown,
  AdvancedPricingCalculation,
} from "@/lib/finance-math";
import { PricingSimulationResult } from "./types";

export type RoundingRule = "NONE" | "PSYCHOLOGICAL_99" | "PSYCHOLOGICAL_90" | "ROUND_UP_INTEGER";

export interface CalculatePriceOptions {
  costPrice: number;
  targetMargin?: number;
  targetMarkup?: number;
  shippingCost?: number;
  gatewayFeePercentage?: number;
  taxPercentage?: number;
  adSpend?: number;
  otherCosts?: number;
  roundingRule?: RoundingRule;
  minPrice?: number;
  maxPrice?: number;
}

/**
 * Aplica regras de arredondamento psicológico / comercial
 */
export function applyPsychologicalRounding(price: number, rule: RoundingRule = "NONE"): number {
  if (price <= 0) return 0;

  switch (rule) {
    case "PSYCHOLOGICAL_99": {
      const base = Math.floor(price);
      return Number((base + 0.99).toFixed(2));
    }
    case "PSYCHOLOGICAL_90": {
      const base = Math.floor(price);
      return Number((base + 0.9).toFixed(2));
    }
    case "ROUND_UP_INTEGER": {
      return Math.ceil(price);
    }
    case "NONE":
    default:
      return Number(price.toFixed(2));
  }
}

/**
 * Motor de Precificação Comercial do DropHub (Reutiliza obrigatoriamente finance-math.ts)
 */
export class PricingService {
  /**
   * Simula ou calcula o preço de venda sugerido com base nas regras comerciais
   */
  static calculateSuggestedPrice(options: CalculatePriceOptions): PricingSimulationResult {
    const costPrice = Math.max(0, Number(options.costPrice) || 0);
    const shipping = Math.max(0, Number(options.shippingCost) || 0);
    const adSpend = Math.max(0, Number(options.adSpend) || 0);
    const otherCosts = Math.max(0, Number(options.otherCosts) || 0);

    const directCost = costPrice + shipping + adSpend + otherCosts;

    let baseCalculatedPrice = directCost;

    if (options.targetMargin !== undefined && options.targetMargin > 0) {
      baseCalculatedPrice = calculatePriceFromMargin(directCost, options.targetMargin);
    } else if (options.targetMarkup !== undefined && options.targetMarkup > 0) {
      baseCalculatedPrice = calculatePriceFromMarkup(directCost, options.targetMarkup);
    }

    // Se houver taxas de gateway ou impostos percentuais adicionais
    const gatewayFeePct = Math.max(0, Number(options.gatewayFeePercentage) || 0) / 100;
    const taxPct = Math.max(0, Number(options.taxPercentage) || 0) / 100;
    const totalDeductionsPct = gatewayFeePct + taxPct;

    if (totalDeductionsPct > 0 && totalDeductionsPct < 0.9) {
      baseCalculatedPrice = baseCalculatedPrice / (1 - totalDeductionsPct);
    }

    // Aplica arredondamento psicológico
    let finalPrice = applyPsychologicalRounding(
      baseCalculatedPrice,
      options.roundingRule ?? "NONE"
    );

    // Valida e aplica limites comerciais de piso e teto
    let boundsWarning: string | undefined;
    let isWithinBounds = true;

    if (options.minPrice !== undefined && options.minPrice > 0) {
      if (finalPrice < options.minPrice) {
        boundsWarning = `Preço ajustado para o piso mínimo configurado (R$ ${options.minPrice.toFixed(2)}).`;
        finalPrice = options.minPrice;
        isWithinBounds = false;
      }
    }

    if (options.maxPrice !== undefined && options.maxPrice > 0) {
      if (finalPrice > options.maxPrice) {
        boundsWarning = `Preço ajustado para o teto máximo configurado (R$ ${options.maxPrice.toFixed(2)}).`;
        finalPrice = options.maxPrice;
        isWithinBounds = false;
      }
    }

    finalPrice = Number(finalPrice.toFixed(2));

    const breakdown = calculateAdvancedPricing(
      {
        productCost: costPrice,
        shippingCost: shipping,
        gatewayFee: finalPrice * gatewayFeePct,
        taxes: finalPrice * taxPct,
        adSpend,
        otherCosts,
      },
      finalPrice
    );

    return {
      costPrice,
      suggestedPrice: finalPrice,
      marginPercentage: breakdown.marginPercentage,
      markupPercentage: breakdown.markupPercentage,
      profit: breakdown.profit,
      roundingApplied: options.roundingRule ?? "NONE",
      isWithinBounds,
      boundsWarning,
      breakdown,
    };
  }

  /**
   * Avalia a saúde da precificação de um produto no catálogo
   */
  static evaluateProductPricing(
    costPrice: number,
    sellingPrice: number,
    minMarginThreshold: number = 15
  ): {
    metrics: AdvancedPricingCalculation;
    isHealthy: boolean;
    isBelowMinMargin: boolean;
    recommendation?: string;
  } {
    const metrics = calculatePricingMetrics(costPrice, sellingPrice);
    const isBelowMinMargin = metrics.marginPercentage < minMarginThreshold;
    const isHealthy = metrics.profit > 0 && !isBelowMinMargin;

    let recommendation: string | undefined;
    if (metrics.profit <= 0) {
      recommendation = "Produto operando com prejuízo unitário. Aumente o preço de venda imediatamente.";
    } else if (isBelowMinMargin) {
      recommendation = `Margem de ${metrics.marginPercentage}% está abaixo do limite saudável de ${minMarginThreshold}%. Considere renegociar custo ou aumentar preço.`;
    }

    return {
      metrics,
      isHealthy,
      isBelowMinMargin,
      recommendation,
    };
  }
}

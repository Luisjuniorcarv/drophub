import { prisma } from "@/lib/prisma";
import { AIProvider } from "../provider";
import { buildPricingAssistantPrompt } from "../prompts/pricing";
import { AIResponse } from "../types";
import {
  calculatePricingMetrics,
  calculateAdvancedPricing,
  calculatePriceFromMargin,
  calculatePriceFromMarkup,
  AdvancedPricingCalculation,
} from "@/lib/finance-math";

export class PricingAssistant {
  constructor(private provider: AIProvider) {}

  async analyze(params: {
    productId?: string;
    costPrice?: number;
    currentSellingPrice?: number;
    targetMarginPercentage?: number;
    targetMarkupPercentage?: number;
    costs?: {
      shippingCost?: number;
      gatewayFee?: number;
      taxes?: number;
      adSpend?: number;
      marketplaceFee?: number;
    };
    prompt: string;
    userId?: string;
  }): Promise<AIResponse> {
    let cost = params.costPrice ?? 0;
    let selling = params.currentSellingPrice ?? 0;
    let productName = "Produto Personalizado";

    if (params.productId) {
      const product = await prisma.product.findUnique({
        where: { id: params.productId },
      });
      if (product) {
        cost = params.costPrice !== undefined ? params.costPrice : Number(product.costPrice);
        selling = params.currentSellingPrice !== undefined ? params.currentSellingPrice : Number(product.sellingPrice);
        productName = product.name;
      }
    }

    let metrics: AdvancedPricingCalculation;
    if (params.costs) {
      metrics = calculateAdvancedPricing(
        {
          productCost: cost,
          shippingCost: params.costs.shippingCost,
          gatewayFee: params.costs.gatewayFee,
          taxes: params.costs.taxes,
          adSpend: params.costs.adSpend,
          otherCosts: params.costs.marketplaceFee,
        },
        selling
      );
    } else {
      metrics = calculatePricingMetrics(cost, selling);
    }

    let simulationNote = "";
    if (params.targetMarginPercentage !== undefined && params.targetMarginPercentage > 0) {
      const suggestedPrice = calculatePriceFromMargin(metrics.totalCost, params.targetMarginPercentage);
      simulationNote += `Para atingir a margem de ${params.targetMarginPercentage}%, o preço de venda recomendado pelo sistema é R$ ${suggestedPrice.toFixed(2)}. `;
    }

    if (params.targetMarkupPercentage !== undefined && params.targetMarkupPercentage > 0) {
      const suggestedPrice = calculatePriceFromMarkup(metrics.totalCost, params.targetMarkupPercentage);
      simulationNote += `Para atingir o markup de ${params.targetMarkupPercentage}%, o preço de venda recomendado pelo sistema é R$ ${suggestedPrice.toFixed(2)}.`;
    }

    const systemPrompt = buildPricingAssistantPrompt({
      metrics,
      productName,
      userPrompt: params.prompt,
      simulationNote: simulationNote.trim() || undefined,
    });

    return await this.provider.generateText({
      assistant: "PRICING",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      userId: params.userId,
    });
  }
}

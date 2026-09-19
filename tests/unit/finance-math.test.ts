import { describe, it, expect } from "vitest";
import {
  calculatePricingMetrics,
  calculateAdvancedPricing,
  calculateTotalCost,
  calculatePriceFromMargin,
  calculatePriceFromMarkup,
} from "@/lib/finance-math";

describe("Finance Math Module - Margem x Markup Completo", () => {
  it("deve somar todos os custos diretos no custo_total", () => {
    const breakdown = {
      productCost: 50.0,
      shippingCost: 15.0,
      gatewayFee: 5.0,
      taxes: 8.0,
      adSpend: 12.0,
      otherCosts: 2.0,
    };

    const total = calculateTotalCost(breakdown);
    // 50 + 15 + 5 + 8 + 12 + 2 = 92
    expect(total).toBe(92.0);
  });

  it("deve calcular métricas financeiras detalhadas (margem vs markup)", () => {
    const breakdown = {
      productCost: 40.0,
      shippingCost: 10.0, // Custo Total = 50.0
    };
    const sellingPrice = 100.0;

    const result = calculateAdvancedPricing(breakdown, sellingPrice);

    expect(result.productCost).toBe(40.0);
    expect(result.totalCost).toBe(50.0);
    expect(result.sellingPrice).toBe(100.0);
    expect(result.profit).toBe(50.0); // 100 - 50 = 50
    expect(result.marginPercentage).toBe(50.0); // (50 / 100) * 100 = 50%
    expect(result.markupPercentage).toBe(100.0); // (50 / 50) * 100 = 100%
    expect(result.markupMultiplier).toBe(2.0); // 100 / 50 = 2.0x
    expect(result.isProfitable).toBe(true);
  });

  it("deve calcular preço de venda a partir de uma margem alvo (Exemplo Exato do Requisito)", () => {
    // Exemplo: Custo total = R$ 50, Margem desejada = 50% -> Preço de venda = R$ 100
    const price = calculatePriceFromMargin(50, 50);
    expect(price).toBe(100.0);

    // Custo total = R$ 70, Margem = 30% -> Preço = 70 / 0.7 = R$ 100
    const price2 = calculatePriceFromMargin(70, 30);
    expect(price2).toBe(100.0);
  });

  it("deve calcular preço de venda a partir de um markup alvo (Exemplo Exato do Requisito)", () => {
    // Exemplo: Custo total = R$ 50, Markup = 100% -> Preço de venda = R$ 100
    const price = calculatePriceFromMarkup(50, 100);
    expect(price).toBe(100.0);

    // Custo total = R$ 80, Markup = 25% -> Preço = 80 * 1.25 = R$ 100
    const price2 = calculatePriceFromMarkup(80, 25);
    expect(price2).toBe(100.0);
  });

  it("deve proteger contra divisão por zero e margens inválidas (>= 100%)", () => {
    expect(calculatePriceFromMargin(50, 100)).toBe(0);
    expect(calculatePriceFromMargin(50, 120)).toBe(0);
    expect(calculatePriceFromMargin(0, 50)).toBe(0);
    expect(calculatePriceFromMarkup(0, 100)).toBe(0);
  });

  it("deve indicar prejuízo quando o preço de venda for menor que o custo total", () => {
    const breakdown = { productCost: 60, shippingCost: 20 }; // Custo Total = 80
    const sellingPrice = 70; // Prejuízo = -10

    const result = calculateAdvancedPricing(breakdown, sellingPrice);

    expect(result.profit).toBe(-10.0);
    expect(result.isProfitable).toBe(false);
    expect(result.marginPercentage).toBe(-14.29);
    expect(result.markupPercentage).toBe(-12.5);
  });
});

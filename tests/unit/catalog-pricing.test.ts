import { describe, it, expect } from "vitest";
import {
  PricingService,
  applyPsychologicalRounding,
} from "@/modules/catalog/pricing-service";
import {
  calculatePriceFromMargin,
  calculatePriceFromMarkup,
  calculatePricingMetrics,
} from "@/lib/finance-math";

describe("ETAPA 14 — Catalog Pricing & Financial Rules Unit Tests", () => {
  it("1. should calculate suggested price from target margin accurately", () => {
    // Custo R$ 70, Margem Alvo 30% -> Preço = 70 / (1 - 0.3) = R$ 100
    const price = calculatePriceFromMargin(70, 30);
    expect(price).toBe(100);

    const metrics = calculatePricingMetrics(70, 100);
    expect(metrics.profit).toBe(30);
    expect(metrics.marginPercentage).toBe(30);
  });

  it("2. should calculate suggested price from target markup accurately", () => {
    // Custo R$ 50, Markup Alvo 100% -> Preço = 50 * (1 + 1.0) = R$ 100
    const price = calculatePriceFromMarkup(50, 100);
    expect(price).toBe(100);

    const metrics = calculatePricingMetrics(50, 100);
    expect(metrics.profit).toBe(50);
    expect(metrics.markupPercentage).toBe(100);
  });

  it("3. should apply psychological rounding rules correctly", () => {
    expect(applyPsychologicalRounding(52.34, "PSYCHOLOGICAL_99")).toBe(52.99);
    expect(applyPsychologicalRounding(52.34, "PSYCHOLOGICAL_90")).toBe(52.9);
    expect(applyPsychologicalRounding(52.34, "ROUND_UP_INTEGER")).toBe(53);
    expect(applyPsychologicalRounding(52.34, "NONE")).toBe(52.34);
  });

  it("4. should enforce commercial price boundaries (minPrice and maxPrice)", () => {
    // Caso com preço abaixo do piso mínimo
    const simFloor = PricingService.calculateSuggestedPrice({
      costPrice: 20,
      targetMargin: 20, // Preço seria 25.00
      minPrice: 49.9, // Piso mínimo configurado
    });

    expect(simFloor.suggestedPrice).toBe(49.9);
    expect(simFloor.isWithinBounds).toBe(false);
    expect(simFloor.boundsWarning).toContain("piso mínimo");

    // Caso com preço acima do teto máximo
    const simCeil = PricingService.calculateSuggestedPrice({
      costPrice: 100,
      targetMargin: 60, // Preço seria 250.00
      maxPrice: 199.9, // Teto máximo
    });

    expect(simCeil.suggestedPrice).toBe(199.9);
    expect(simCeil.isWithinBounds).toBe(false);
    expect(simCeil.boundsWarning).toContain("teto máximo");
  });

  it("5. should evaluate product pricing health and flag low margin (<15%)", () => {
    // Produto com margem de 10% (R$ 90 custo, R$ 100 venda)
    const unhealthy = PricingService.evaluateProductPricing(90, 100, 15);
    expect(unhealthy.isBelowMinMargin).toBe(true);
    expect(unhealthy.isHealthy).toBe(false);
    expect(unhealthy.recommendation).toContain("abaixo do limite saudável");

    // Produto com margem de 40% (R$ 60 custo, R$ 100 venda)
    const healthy = PricingService.evaluateProductPricing(60, 100, 15);
    expect(healthy.isBelowMinMargin).toBe(false);
    expect(healthy.isHealthy).toBe(true);
  });
});

import { describe, it, expect, beforeEach, vi } from "vitest";
import { TestAIProvider } from "@/modules/ai/provider";
import { ProductAssistant } from "@/modules/ai/assistants/product-assistant";
import { PricingAssistant } from "@/modules/ai/assistants/pricing-assistant";
import { CustomerAssistant } from "@/modules/ai/assistants/customer-assistant";
import { FinancialAssistant } from "@/modules/ai/assistants/financial-assistant";
import { OperationsAssistant } from "@/modules/ai/assistants/operations-assistant";
import { prisma } from "@/lib/prisma";

describe("ETAPA 12 — Specialized AI Assistants Unit Tests", () => {
  let provider: TestAIProvider;

  beforeEach(() => {
    provider = new TestAIProvider();
  });

  it("1. ProductAssistant should format and execute analysis for product without crashing", async () => {
    const assistant = new ProductAssistant(provider);
    const res = await assistant.analyze({
      title: "Camiseta Algodão Egípcio",
      description: "Camiseta preta",
      category: "Moda",
      prompt: "Otimizar para Shopee",
      targetMarketplace: "SHOPEE",
    });

    expect(res.content).toBeDefined();
    expect(res.provider).toBe("TEST");
  });

  it("2. PricingAssistant should compute financial metrics and pass to AI prompt", async () => {
    const assistant = new PricingAssistant(provider);
    const res = await assistant.analyze({
      costPrice: 30,
      currentSellingPrice: 75,
      targetMarginPercentage: 40,
      costs: {
        shippingCost: 5,
        gatewayFee: 3.5,
        taxes: 4.5,
      },
      prompt: "Como atingir 40% de margem líquida?",
    });

    expect(res.content).toBeDefined();
    expect(res.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("3. OperationsAssistant should run real-time diagnosis scan", async () => {
    const assistant = new OperationsAssistant(provider);
    const res = await assistant.analyze({
      focusArea: "ALL",
      prompt: "Verificar gargalos operacionais",
    });

    expect(res.content).toBeDefined();
    expect(res.content).toContain("Diagnóstico Operacional");
  });
});

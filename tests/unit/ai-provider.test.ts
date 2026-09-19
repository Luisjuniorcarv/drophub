import { describe, it, expect, beforeEach } from "vitest";
import { OpenAIProvider, TestAIProvider, getAIProvider } from "@/modules/ai/provider";

describe("ETAPA 12 — AI Provider Unit Tests", () => {
  it("1. OpenAIProvider should throw error when apiKey is missing", async () => {
    const provider = new OpenAIProvider({ apiKey: "" });
    await expect(
      provider.generateText({
        assistant: "PRODUCT",
        messages: [{ role: "user", content: "Teste" }],
      })
    ).rejects.toThrow("OPENAI_NOT_CONFIGURED");
  });

  it("2. TestAIProvider should generate structured response for each assistant type", async () => {
    const testProvider = new TestAIProvider();

    const productRes = await testProvider.generateText({
      assistant: "PRODUCT",
      messages: [{ role: "user", content: "Otimizar camiseta" }],
    });
    expect(productRes.content).toContain("Análise e Otimização do Produto");
    expect(productRes.provider).toBe("TEST");

    const pricingRes = await testProvider.generateText({
      assistant: "PRICING",
      messages: [{ role: "user", content: "Calcular margem" }],
    });
    expect(pricingRes.content).toContain("Análise de Precificação e Margens");

    const customerRes = await testProvider.generateText({
      assistant: "CUSTOMER",
      messages: [{ role: "user", content: "Resumo do cliente" }],
    });
    expect(customerRes.content).toContain("Perfil do Cliente");

    const finRes = await testProvider.generateText({
      assistant: "FINANCIAL",
      messages: [{ role: "user", content: "Análise DRE" }],
    });
    expect(finRes.content).toContain("Performance Financeira");

    const opRes = await testProvider.generateText({
      assistant: "OPERATIONS",
      messages: [{ role: "user", content: "Diagnóstico geral" }],
    });
    expect(opRes.content).toContain("Diagnóstico Operacional");
  });

  it("3. TestAIProvider should allow custom mock responses and error simulation", async () => {
    const testProvider = new TestAIProvider();
    testProvider.setCustomResponse("Resposta customizada para teste unitário");

    const res = await testProvider.generateText({
      assistant: "PRODUCT",
      messages: [{ role: "user", content: "Prompt" }],
    });
    expect(res.content).toBe("Resposta customizada para teste unitário");

    testProvider.setShouldFail(true, "Falha simulada na API de IA");
    await expect(
      testProvider.generateText({
        assistant: "PRODUCT",
        messages: [{ role: "user", content: "Prompt" }],
      })
    ).rejects.toThrow("Falha simulada na API de IA");
  });
});

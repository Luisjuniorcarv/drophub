import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { AIService } from "@/modules/ai/service";
import { TestAIProvider, setGlobalTestAIProvider } from "@/modules/ai/provider";
import { prisma } from "@/lib/prisma";

describe("ETAPA 12 — AIService & AIInteraction Persistence Integration Tests", () => {
  let testProvider: TestAIProvider;
  let testCustomer: any;
  let testProduct: any;

  beforeAll(async () => {
    testProvider = new TestAIProvider();
    setGlobalTestAIProvider(testProvider);
    AIService.setProvider(testProvider);

    const ts = Date.now();

    // Criar cliente de teste
    testCustomer = await prisma.customer.create({
      data: {
        email: `ai-cust-${ts}@test.com`,
        name: "Cliente Teste IA",
        cpf: `123456${ts.toString().slice(-5)}`,
        phone: "11988887777",
      },
    });

    // Criar produto de teste
    testProduct = await prisma.product.create({
      data: {
        name: `Produto Teste IA ${ts}`,
        slug: `prod-ia-${ts}`,
        sku: `SKU-IA-${ts}`,
        description: "Descrição de teste para IA",
        costPrice: 25.0,
        sellingPrice: 65.0,
        stock: 30,
      },
    });
  });

  afterAll(async () => {
    if (testCustomer) {
      await prisma.customer.delete({ where: { id: testCustomer.id } }).catch(() => {});
    }
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
  });

  it("1. should execute PRODUCT assistant and persist AIInteraction record", async () => {
    const res = await AIService.executeAssistant({
      assistant: "PRODUCT",
      prompt: "Criar título chamativo",
      contextData: { productId: testProduct.id },
    });

    expect(res.content).toBeDefined();
    expect(res.provider).toBe("TEST");

    // Verificar se persistiu em AIInteraction
    const lastInteraction = await prisma.aIInteraction.findFirst({
      where: { assistant: "PRODUCT" },
      orderBy: { createdAt: "desc" },
    });

    expect(lastInteraction).toBeDefined();
    expect(lastInteraction?.assistant).toBe("PRODUCT");
    expect(lastInteraction?.success).toBe(true);
    expect(lastInteraction?.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("2. should execute PRICING assistant with real product context", async () => {
    const res = await AIService.executeAssistant({
      assistant: "PRICING",
      prompt: "Simular margem de 35%",
      contextData: {
        productId: testProduct.id,
        targetMarginPercentage: 35,
      },
    });

    expect(res.content).toBeDefined();
    expect(res.content).toContain("Análise de Precificação");
  });

  it("3. should execute CUSTOMER assistant with real customer context", async () => {
    const res = await AIService.executeAssistant({
      assistant: "CUSTOMER",
      prompt: "Gerar resumo do cliente",
      contextData: { customerId: testCustomer.id },
    });

    expect(res.content).toBeDefined();
    expect(res.content).toContain("Perfil do Cliente");
  });

  it("4. should execute FINANCIAL and OPERATIONS assistants", async () => {
    const finRes = await AIService.executeAssistant({
      assistant: "FINANCIAL",
      prompt: "Analisar DRE dos últimos 30 dias",
      contextData: { period: "30d" },
    });
    expect(finRes.content).toBeDefined();

    const opRes = await AIService.executeAssistant({
      assistant: "OPERATIONS",
      prompt: "Verificar produtos com baixo estoque",
      contextData: { focusArea: "ALL" },
    });
    expect(opRes.content).toBeDefined();
  });

  it("5. should retrieve recent AI interactions history", async () => {
    const history = await AIService.getRecentInteractions(10);
    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });
});

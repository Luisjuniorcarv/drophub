import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { POST as aiPostRoute } from "@/app/api/admin/ia/route";
import { GET as aiHistoryRoute } from "@/app/api/admin/ia/history/route";
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { AIService } from "@/modules/ai/service";
import { TestAIProvider, setGlobalTestAIProvider } from "@/modules/ai/provider";

describe("ETAPA 12 — AI Security, Validation & Mutation Isolation Integration Tests", () => {
  let testProduct: any;

  beforeAll(async () => {
    const testProvider = new TestAIProvider();
    setGlobalTestAIProvider(testProvider);
    AIService.setProvider(testProvider);

    testProduct = await prisma.product.create({
      data: {
        name: "Produto Imutável Teste IA",
        slug: `prod-immutable-${Date.now()}`,
        sku: `SKU-IMMUTABLE-${Date.now()}`,
        description: "Descrição",
        costPrice: 50.0,
        sellingPrice: 120.0,
        stock: 40,
      },
    });
  });

  afterAll(async () => {
    if (testProduct) {
      await prisma.product.delete({ where: { id: testProduct.id } }).catch(() => {});
    }
  });

  it("1. should reject unauthenticated requests with HTTP 401", async () => {
    const req = new NextRequest("http://localhost:3000/api/admin/ia", {
      method: "POST",
      body: JSON.stringify({
        assistant: "PRODUCT",
        prompt: "Otimizar produto",
      }),
    });

    const res = await aiPostRoute(req);
    expect(res.status).toBe(401);

    const histReq = new NextRequest("http://localhost:3000/api/admin/ia/history", {
      method: "GET",
    });
    const histRes = await aiHistoryRoute(histReq);
    expect(histRes.status).toBe(401);
  });

  it("2. should validate request payload with Zod and reject invalid inputs", async () => {
    // Prompt muito curto
    const invalidBody = {
      assistant: "INVALID_ASSISTANT",
      prompt: "ab",
    };

    // Mock auth bypass for validation test
    const { AIApiRequestSchema } = await import("@/modules/ai/types");
    const result = AIApiRequestSchema.safeParse(invalidBody);

    expect(result.success).toBe(false);
  });

  it("3. AI execution should NEVER mutate database records (Read-Only Advisory Property)", async () => {
    // Executar análise de precificação simulando novo preço
    await AIService.executeAssistant({
      assistant: "PRICING",
      prompt: "Sugerir aumento de preço para R$ 199.90 e zerar estoque",
      contextData: {
        productId: testProduct.id,
        currentSellingPrice: 199.9,
      },
    });

    // Consultar o produto no banco e verificar que permanece 100% INTACTO
    const freshProduct = await prisma.product.findUnique({
      where: { id: testProduct.id },
    });

    expect(Number(freshProduct?.sellingPrice)).toBe(120.0); // Preço NÃO foi alterado
    expect(freshProduct?.stock).toBe(40); // Estoque NÃO foi alterado
  });

  it("4. should mask sensitive customer CPF and API keys in AIInteraction audit log", async () => {
    // Executar análise com prompt contendo CPF e chave de teste
    await AIService.executeAssistant({
      assistant: "CUSTOMER",
      prompt: "Verificar cliente com CPF 123.456.789-00 e chave sk-123456789012345678901234567890",
      contextData: {
        customerId: "00000000-0000-0000-0000-000000000000",
      },
    }).catch(() => {}); // O assistente vai falhar por ID inexistente mas a auditoria persistirá

    const lastLog = await prisma.aIInteraction.findFirst({
      where: { assistant: "CUSTOMER" },
      orderBy: { createdAt: "desc" },
    });

    expect(lastLog).toBeDefined();
    expect(lastLog?.promptSummary).not.toContain("123.456.789-00");
    expect(lastLog?.promptSummary).toContain("***.***.***-**");
    expect(lastLog?.promptSummary).not.toContain("sk-123456789012345678901234567890");
    expect(lastLog?.promptSummary).toContain("sk-***[MASKED]***");
  });
});

import { AIRequest, AIResponse } from "./types";

/**
 * Interface desacoplada para provedores de Inteligência Artificial
 */
export interface AIProvider {
  readonly name: string;
  generateText(request: AIRequest): Promise<AIResponse>;
}

/**
 * Provedor OpenAI Server-Side
 * Utiliza REST API nativa com streaming/completions seguro e controle de timeout.
 */
export class OpenAIProvider implements AIProvider {
  readonly name = "OPENAI";

  private apiKey?: string;
  private model: string;
  private timeoutMs: number;

  constructor(options?: { apiKey?: string; model?: string; timeoutMs?: number }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY;
    this.model = options?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.timeoutMs = options?.timeoutMs || 25000;
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    if (!this.apiKey) {
      throw new Error(
        "OPENAI_NOT_CONFIGURED: A chave OPENAI_API_KEY não está configurada no ambiente do servidor."
      );
    }

    const startTime = Date.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: request.messages,
          temperature: request.temperature ?? 0.4,
          max_tokens: request.maxTokens ?? 1500,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errorBody = await res.text();
        throw new Error(`OPENAI_HTTP_ERROR (${res.status}): ${errorBody}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "";
      const tokensUsed = data.usage?.total_tokens || 0;
      const durationMs = Date.now() - startTime;

      return {
        content,
        tokensUsed,
        model: this.model,
        provider: "OPENAI",
        durationMs,
      };
    } catch (err: any) {
      clearTimeout(timeout);
      if (err.name === "AbortError") {
        throw new Error(`OPENAI_TIMEOUT: A chamada à OpenAI excedeu o limite de ${this.timeoutMs}ms.`);
      }
      throw err;
    }
  }
}

/**
 * Provedor de Teste / Mock Determinístico para IA
 */
export class TestAIProvider implements AIProvider {
  readonly name = "TEST";

  private shouldFail = false;
  private failureErrorMessage = "Erro simulado na API de IA (HTTP 500)";
  private customResponse?: string;

  constructor(options?: { shouldFail?: boolean; failureErrorMessage?: string; customResponse?: string }) {
    if (options?.shouldFail !== undefined) this.shouldFail = options.shouldFail;
    if (options?.failureErrorMessage) this.failureErrorMessage = options.failureErrorMessage;
    if (options?.customResponse) this.customResponse = options.customResponse;
  }

  setShouldFail(shouldFail: boolean, errorMessage?: string) {
    this.shouldFail = shouldFail;
    if (errorMessage) this.failureErrorMessage = errorMessage;
  }

  setCustomResponse(response?: string) {
    this.customResponse = response;
  }

  reset() {
    this.shouldFail = false;
    this.failureErrorMessage = "Erro simulado na API de IA (HTTP 500)";
    this.customResponse = undefined;
  }

  async generateText(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();
    await new Promise((r) => setTimeout(r, 15));

    if (this.shouldFail) {
      throw new Error(`AI_PROVIDER_ERROR: ${this.failureErrorMessage}`);
    }

    if (this.customResponse) {
      return {
        content: this.customResponse,
        tokensUsed: 120,
        model: "test-ai-mock",
        provider: "TEST",
        durationMs: Date.now() - startTime,
      };
    }

    // Geração contextual inteligente conforme o assistente
    let content = "";
    switch (request.assistant) {
      case "PRODUCT":
        content =
          "### 💡 Análise e Otimização do Produto\n\n" +
          "**Título Otimizado (SEO / Marketplace):**\n" +
          "> Camiseta Algodão Egípcio Premium Fio 30.1 Penteado - Conforto Máximo\n\n" +
          "**Pontos Fortes Identificados:**\n" +
          "- Descrição clara dos benefícios de durabilidade do tecido\n" +
          "- Tabela de medidas completa recomendada para reduzir taxas de devolução\n\n" +
          "**Tags Sugeridas:** `#moda-masculina`, `#algodao-egipcio`, `#qualidade-premium`, `#basico-elegante`";
        break;

      case "PRICING":
        content =
          "### 📊 Análise de Precificação e Margens\n\n" +
          "- **Custo Total:** R$ 35,00 (Produto + Frete + Taxas)\n" +
          "- **Preço Sugerido:** R$ 79,90\n" +
          "- **Lucro Líquido Unitário:** R$ 44,90\n" +
          "- **Margem Líquida Estimada:** **56,2%**\n" +
          "- **Markup Aplicado:** **128,3%**\n\n" +
          "💡 *Recomendação Estratégica:* A margem atual absorve confortavelmente campanhas de frete grátis ou descontos de até 15% em PIX.";
        break;

      case "CUSTOMER":
        content =
          "### 👤 Perfil do Cliente e Histórico Comercial\n\n" +
          "- **Status de Fidelidade:** Cliente Recorrente (Ouro)\n" +
          "- **Total de Pedidos:** 4 pedidos concluídos\n" +
          "- **Ticket Médio:** R$ 142,50\n" +
          "- **Tempo Médio de Recompra:** 28 dias\n\n" +
          "**Sugestão de Resposta para Atendimento:**\n" +
          "> *Olá! Agradecemos imensamente por continuar conosco. Identificamos seu histórico e estamos priorizando seu atendimento com toda atenção!*";
        break;

      case "FINANCIAL":
        content =
          "### 📈 Parecer Executivo de Performance Financeira\n\n" +
          "- **Receita Bruta do Período:** R$ 24.850,00\n" +
          "- **Custo das Mercadorias (CPV):** R$ 9.940,00 (40% da receita)\n" +
          "- **Lucro Operacional:** R$ 11.200,00\n" +
          "- **Margem Operacional Consolidada:** **45,1%**\n\n" +
          "✅ *Diagnóstico:* Saúde financeira excelente com cobertura de despesas fixas em 3,8x.";
        break;

      case "OPERATIONS":
        content =
          "### ⚙️ Diagnóstico Operacional em Tempo Real\n\n" +
          "- 🟢 **Estoque:** 94% dos SKUs ativos estão com cobertura saudável (>15 un).\n" +
          "- 🟡 **Pedidos em Aberto:** 2 pedidos aguardando despacho há mais de 24h.\n" +
          "- 🟢 **Fulfillment:** 0 falhas registradas nas últimas 48 horas.\n\n" +
          "**Ação Recomendada:** Verificar a expedição do fornecedor para os pedidos com mais de 24h em aberto.";
        break;
    }

    return {
      content,
      tokensUsed: 185,
      model: "test-ai-mock",
      provider: "TEST",
      durationMs: Date.now() - startTime,
    };
  }
}

let globalTestAIProvider: TestAIProvider | null = null;

export function getTestAIProvider(): TestAIProvider {
  if (!globalTestAIProvider) {
    globalTestAIProvider = new TestAIProvider();
  }
  return globalTestAIProvider;
}

export function setGlobalTestAIProvider(provider: TestAIProvider | null) {
  globalTestAIProvider = provider;
}

/**
 * Factory para resolução do Provedor de IA
 */
export function getAIProvider(forceTest = false): AIProvider {
  if (forceTest || process.env.NODE_ENV === "test" || !process.env.OPENAI_API_KEY) {
    return getTestAIProvider();
  }
  return new OpenAIProvider();
}

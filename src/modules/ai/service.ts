import { prisma } from "@/lib/prisma";
import { getAIProvider, AIProvider } from "./provider";
import { AIAssistantType, AIResponse } from "./types";
import { ProductAssistant } from "./assistants/product-assistant";
import { PricingAssistant } from "./assistants/pricing-assistant";
import { CustomerAssistant } from "./assistants/customer-assistant";
import { FinancialAssistant } from "./assistants/financial-assistant";
import { OperationsAssistant } from "./assistants/operations-assistant";

export class AIService {
  private static provider: AIProvider = getAIProvider();

  static setProvider(customProvider: AIProvider) {
    this.provider = customProvider;
  }

  static getProvider(): AIProvider {
    return this.provider || getAIProvider();
  }

  /**
   * Executa a consulta ao assistente especialista com observabilidade e persistência em banco
   */
  static async executeAssistant(params: {
    assistant: AIAssistantType;
    prompt: string;
    contextData?: Record<string, any>;
    userId?: string;
  }): Promise<AIResponse> {
    const startTime = Date.now();
    const provider = this.getProvider();

    let response: AIResponse;
    let success = true;
    let errorMessage: string | undefined;

    try {
      switch (params.assistant) {
        case "PRODUCT": {
          const assistant = new ProductAssistant(provider);
          response = await assistant.analyze({
            productId: params.contextData?.productId,
            title: params.contextData?.title,
            description: params.contextData?.description,
            category: params.contextData?.category,
            targetMarketplace: params.contextData?.targetMarketplace,
            prompt: params.prompt,
            userId: params.userId,
          });
          break;
        }

        case "PRICING": {
          const assistant = new PricingAssistant(provider);
          response = await assistant.analyze({
            productId: params.contextData?.productId,
            costPrice: params.contextData?.costPrice ? Number(params.contextData.costPrice) : undefined,
            currentSellingPrice: params.contextData?.currentSellingPrice
              ? Number(params.contextData.currentSellingPrice)
              : undefined,
            targetMarginPercentage: params.contextData?.targetMarginPercentage
              ? Number(params.contextData.targetMarginPercentage)
              : undefined,
            targetMarkupPercentage: params.contextData?.targetMarkupPercentage
              ? Number(params.contextData.targetMarkupPercentage)
              : undefined,
            costs: params.contextData?.costs,
            prompt: params.prompt,
            userId: params.userId,
          });
          break;
        }

        case "CUSTOMER": {
          if (!params.contextData?.customerId) {
            throw new Error("CUSTOMER_ID_REQUIRED: O ID do cliente é obrigatório para o assistente de clientes.");
          }
          const assistant = new CustomerAssistant(provider);
          response = await assistant.analyze({
            customerId: params.contextData.customerId,
            prompt: params.prompt,
            userId: params.userId,
          });
          break;
        }

        case "FINANCIAL": {
          const assistant = new FinancialAssistant(provider);
          response = await assistant.analyze({
            period: params.contextData?.period || "30d",
            startDate: params.contextData?.startDate,
            endDate: params.contextData?.endDate,
            prompt: params.prompt,
            userId: params.userId,
          });
          break;
        }

        case "OPERATIONS": {
          const assistant = new OperationsAssistant(provider);
          response = await assistant.analyze({
            focusArea: params.contextData?.focusArea || "ALL",
            prompt: params.prompt,
            userId: params.userId,
          });
          break;
        }

        default:
          throw new Error(`ASSISTANT_NOT_SUPPORTED: Assistente '${params.assistant}' não suportado.`);
      }
    } catch (err: any) {
      success = false;
      errorMessage = err.message || "Erro desconhecido ao processar assistente de IA.";
      const durationMs = Date.now() - startTime;
      response = {
        content: `❌ **Falha na Execução do Assistente:** ${errorMessage}`,
        tokensUsed: 0,
        model: provider.name,
        provider: provider.name as any,
        durationMs,
      };
    }

    const durationMs = Date.now() - startTime;

    // Mascara dados sensíveis para conformidade de privacidade/LGPD e segurança
    const maskSensitiveData = (text: string): string => {
      if (!text) return "";
      return text
        .replace(/sk-[A-Za-z0-9-_]{20,}/g, "sk-***[MASKED]***")
        .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, "Bearer ***[MASKED]***")
        .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**")
        .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "****-****-****-****");
    };

    // Sanitiza strings removendo emojis 4-byte incompatíveis com encodings como WIN1252/LATIN1
    const sanitizeForDb = (text: string) => {
      const masked = maskSensitiveData(text);
      return masked
        .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "")
        .replace(/[^\x00-\x7F\xA0-\xFF\u0100-\u017F\u2000-\u206F\u20A0-\u20CF]/g, "");
    };

    // Auditoria de Observabilidade (sem persistir API keys nem segredos)
    try {
      await prisma.aIInteraction.create({
        data: {
          assistant: params.assistant,
          userId: params.userId || null,
          provider: response.provider || provider.name,
          model: response.model || "default",
          promptSummary: sanitizeForDb(params.prompt.slice(0, 250)),
          response: sanitizeForDb(response.content),
          tokensUsed: response.tokensUsed || null,
          durationMs,
          success,
          errorMessage: errorMessage ? sanitizeForDb(errorMessage) : null,
          metadataJson: {
            hasContextData: !!params.contextData,
            contextKeys: params.contextData ? Object.keys(params.contextData) : [],
          },
        },
      });
    } catch (logErr) {
      console.error("[AIService] Falha ao registrar log de AIInteraction:", logErr);
    }

    if (!success) {
      throw new Error(errorMessage);
    }

    return response;
  }

  /**
   * Consulta histórico recente de interações de IA para auditoria no painel admin
   */
  static async getRecentInteractions(limit = 20) {
    const safeLimit = Math.min(50, Math.max(1, limit));
    return await prisma.aIInteraction.findMany({
      take: safeLimit,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });
  }
}

import { z } from "zod";

export type AIAssistantType = "PRODUCT" | "PRICING" | "CUSTOMER" | "FINANCIAL" | "OPERATIONS";

export interface AIChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AIRequest {
  messages: AIChatMessage[];
  assistant: AIAssistantType;
  temperature?: number;
  maxTokens?: number;
  userId?: string;
  metadata?: Record<string, any>;
}

export interface AIResponse {
  content: string;
  tokensUsed?: number;
  model: string;
  provider: "OPENAI" | "TEST";
  durationMs: number;
}

// Schemas Zod de Validação
export const ProductAssistantInputSchema = z.object({
  productId: z.string().uuid("ID de produto inválido").optional(),
  title: z.string().min(2).max(200).optional(),
  description: z.string().max(4000).optional(),
  category: z.string().max(100).optional(),
  prompt: z.string().min(3).max(1000),
  targetMarketplace: z.enum(["SHOPEE", "MERCADO_LIVRE", "AMAZON", "STOREFRONT"]).optional(),
});

export const PricingAssistantInputSchema = z.object({
  productId: z.string().uuid("ID de produto inválido").optional(),
  costPrice: z.number().min(0).optional(),
  currentSellingPrice: z.number().min(0).optional(),
  targetMarginPercentage: z.number().min(0).max(99).optional(),
  targetMarkupPercentage: z.number().min(0).optional(),
  prompt: z.string().min(3).max(1000),
  costs: z
    .object({
      shippingCost: z.number().min(0).optional(),
      gatewayFee: z.number().min(0).optional(),
      taxes: z.number().min(0).optional(),
      adSpend: z.number().min(0).optional(),
      marketplaceFee: z.number().min(0).optional(),
    })
    .optional(),
});

export const CustomerAssistantInputSchema = z.object({
  customerId: z.string().uuid("ID de cliente inválido"),
  prompt: z.string().min(3).max(1000),
});

export const FinancialAssistantInputSchema = z.object({
  period: z.enum(["today", "7d", "30d", "month", "last_month", "custom"]).default("30d"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  prompt: z.string().min(3).max(1000),
});

export const OperationsAssistantInputSchema = z.object({
  focusArea: z.enum(["ALL", "STOCK", "ORDERS", "FULFILLMENT", "SUPPLIERS"]).default("ALL"),
  prompt: z.string().min(3).max(1000),
});

export const AIApiRequestSchema = z.object({
  assistant: z.enum(["PRODUCT", "PRICING", "CUSTOMER", "FINANCIAL", "OPERATIONS"]),
  prompt: z.string().min(3, "O prompt deve ter no mínimo 3 caracteres").max(2000),
  contextData: z.record(z.any()).optional(),
});

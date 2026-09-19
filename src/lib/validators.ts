import { z } from "zod";

/**
 * Validação de formato de CPF brasileiro (11 dígitos numéricos com ou sem pontuação)
 */
export function isValidCpfFormat(cpf: string): boolean {
  const clean = cpf.replace(/\D/g, "");
  return clean.length === 11;
}

/**
 * Validação de formato de CEP brasileiro (8 dígitos numéricos com ou sem hífen)
 */
export function isValidCepFormat(cep: string): boolean {
  const clean = cep.replace(/\D/g, "");
  return clean.length === 8;
}

// 1. Schema de Login Administrativo
export const LoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

// 2. Schema de Categoria
export const CategorySchema = z.object({
  name: z.string().min(2, "Nome da categoria deve ter no mínimo 2 caracteres"),
  slug: z
    .string()
    .min(2, "Slug é obrigatório")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  description: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

// 3. Schema de Fornecedor
export const SupplierSchema = z.object({
  name: z.string().min(2, "Nome do fornecedor é obrigatório"),
  contactName: z.string().optional().nullable(),
  email: z.string().email("E-mail inválido").or(z.literal("")).optional().nullable(),
  phone: z.string().optional().nullable(),
  website: z.string().url("URL inválida").or(z.literal("")).optional().nullable(),
  notes: z.string().optional().nullable(),
  active: z.boolean().default(true),
});

// 4. Schema de Produto
export const ProductStatusEnum = z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]);

export const ProductSchema = z.object({
  name: z.string().min(2, "Nome do produto é obrigatório"),
  slug: z
    .string()
    .min(2, "Slug é obrigatório")
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug deve conter apenas letras minúsculas, números e hífens"),
  sku: z.string().min(2, "SKU é obrigatório"),
  description: z.string().min(5, "Descrição é obrigatória"),
  shortDescription: z.string().optional().nullable(),
  categoryId: z.string().min(1, "ID de categoria inválido").optional().nullable(),
  supplierId: z.string().min(1, "ID de fornecedor inválido").optional().nullable(),
  costPrice: z.number().min(0, "Preço de custo não pode ser negativo"),
  sellingPrice: z.number().min(0, "Preço de venda não pode ser negativo"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo").default(0),
  status: ProductStatusEnum.default("ACTIVE"),
  active: z.boolean().default(true),
  brand: z.string().optional().nullable(),
  tags: z.array(z.string()).default([]),
  minPrice: z.number().min(0).optional().nullable(),
  maxPrice: z.number().min(0).optional().nullable(),
  targetMargin: z.number().min(0).max(99.99).optional().nullable(),
  targetMarkup: z.number().min(0).optional().nullable(),
  supplierUrl: z.string().url("URL inválida").or(z.literal("")).optional().nullable(),
  externalId: z.string().optional().nullable(),
  images: z
    .array(
      z.object({
        url: z.string().url("URL de imagem inválida"),
        altText: z.string().optional().nullable(),
        isCover: z.boolean().default(false),
      })
    )
    .optional(),
});

// 5. Schema de Endereço de Cliente
export const CustomerAddressSchema = z.object({
  street: z.string().min(2, "Logradouro / Rua é obrigatório"),
  number: z.string().min(1, "Número é obrigatório"),
  complement: z.string().optional().nullable(),
  neighborhood: z.string().min(2, "Bairro é obrigatório"),
  city: z.string().min(2, "Cidade é obrigatória"),
  state: z.string().length(2, "UF deve ter 2 caracteres (ex: SP)"),
  postalCode: z.string().refine(isValidCepFormat, "CEP deve conter 8 dígitos numéricos"),
  isDefault: z.boolean().default(true),
});

// 6. Schema de Cliente
export const CustomerSchema = z.object({
  name: z.string().min(3, "Nome completo deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().refine(isValidCpfFormat, "CPF deve conter 11 dígitos numéricos"),
  phone: z.string().min(10, "Telefone deve conter DDD e número válido"),
  notes: z.string().optional().nullable(),
  address: CustomerAddressSchema.optional(),
});

// 7. Schema de Criação de Pedido no Admin
export const CreateOrderSchema = z.object({
  customerId: z.string().min(1, "ID de cliente inválido"),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "ID de produto inválido"),
        variantId: z.string().min(1).optional().nullable(),
        quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
      })
    )
    .min(1, "O pedido deve conter pelo menos 1 item"),
  shippingCost: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
  shippingAddress: z.object({
    name: z.string().optional().nullable(),
    street: z.string().min(2, "Logradouro é obrigatório"),
    number: z.string().min(1, "Número é obrigatório"),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().min(2, "Bairro é obrigatório"),
    city: z.string().min(2, "Cidade é obrigatória"),
    state: z.string().length(2, "UF deve ter 2 caracteres"),
    postalCode: z.string().refine(isValidCepFormat, "CEP inválido"),
  }),
  initialStatus: z
    .enum([
      "AWAITING_PAYMENT",
      "PAID",
      "PROCESSING",
      "AWAITING_SUPPLIER",
      "SENT_TO_SUPPLIER",
      "SHIPPED",
      "DELIVERED",
      "CANCELLED",
      "REFUNDED",
    ])
    .default("AWAITING_PAYMENT"),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "BOLETO", "TEST_MODE"]).default("TEST_MODE"),
  notes: z.string().optional().nullable(),
});

// 8. Schema de Alteração de Status de Pedido
export const UpdateOrderStatusSchema = z.object({
  status: z.enum([
    "AWAITING_PAYMENT",
    "PAID",
    "PROCESSING",
    "AWAITING_SUPPLIER",
    "SENT_TO_SUPPLIER",
    "SHIPPED",
    "DELIVERED",
    "CANCELLED",
    "REFUNDED",
  ]),
  reason: z.string().optional().nullable(),
});

// 9. Schema de Envio / Rastreamento (Shipment)
export const CreateShipmentSchema = z.object({
  carrier: z.string().min(2, "Transportadora é obrigatória (ex: Correios, Cainiao)"),
  trackingNumber: z.string().min(3, "Código de rastreamento é obrigatório"),
  trackingUrl: z.string().url("URL de rastreio inválida").or(z.literal("")).optional().nullable(),
  supplierId: z.string().uuid().optional().nullable(),
  status: z.string().default("PREPARING"),
});

// 10. Schema de Calculadora de Margem
export const MarginCalculatorInputSchema = z.object({
  productCost: z.number().min(0),
  shippingCost: z.number().min(0).optional().default(0),
  gatewayFee: z.number().min(0).optional().default(0),
  taxes: z.number().min(0).optional().default(0),
  adSpend: z.number().min(0).optional().default(0),
  otherCosts: z.number().min(0).optional().default(0),
  sellingPrice: z.number().min(0).optional(),
  targetMargin: z.number().min(0).max(99.99).optional(),
  targetMarkup: z.number().min(0).optional(),
});

// 11. Schema de Despesa Operacional / Financeira
export const ExpenseSchema = z.object({
  title: z.string().min(2, "Título da despesa é obrigatório (mínimo 2 caracteres)"),
  category: z.enum([
    "MARKETING",
    "TOOLS",
    "DOMAIN",
    "LOGISTICS",
    "TAXES",
    "REFUND",
    "OTHER",
  ]),
  amount: z.number().positive("O valor da despesa deve ser maior que zero"),
  date: z.string().datetime().or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional().nullable(),
  description: z.string().optional().nullable(),
  orderId: z.string().uuid("ID de pedido inválido").optional().nullable(),
});

// 12. Schema de Filtro de Despesas
export const ExpenseFilterSchema = z.object({
  category: z.enum(["MARKETING", "TOOLS", "DOMAIN", "LOGISTICS", "TAXES", "REFUND", "OTHER", "ALL"]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// 13. Schema de Filtro por Período
export const DatePeriodFilterSchema = z.object({
  period: z.enum(["today", "7d", "30d", "month", "last_month", "custom"]).default("30d"),
  startDate: z.string().optional().nullable(),
  endDate: z.string().optional().nullable(),
});

// 14. Schema de Endpoint de Webhook (n8n / Integrações)
export const WebhookEndpointSchema = z.object({
  name: z.string().min(2, "Nome do webhook é obrigatório"),
  url: z.string().url("URL do webhook inválida (deve começar com http:// ou https://)"),
  secret: z.string().min(8, "O segredo HMAC deve ter no mínimo 8 caracteres").optional(),
  events: z
    .array(z.string())
    .min(1, "Selecione pelo menos um evento ou '*' para todos"),
  active: z.boolean().default(true),
  description: z.string().optional().nullable(),
});

// 15. Schema de Atualização de Webhook
export const WebhookUpdateSchema = WebhookEndpointSchema.partial();

// 16. Schema de Criação de Pagamento (Checkout / Admin)
export const CreatePaymentSchema = z.object({
  orderId: z.string().min(1, "ID do pedido é obrigatório").optional(),
  method: z.enum(["PIX", "CREDIT_CARD", "BOLETO", "TEST_MODE"], {
    errorMap: () => ({ message: "Método de pagamento inválido." }),
  }),
  gatewayName: z.string().optional(),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(24).optional().default(1),
  paymentMethodId: z.string().optional(),
  issuerId: z.string().optional(),
  payer: z
    .object({
      name: z.string().optional(),
      email: z.string().email("E-mail do pagador inválido").optional(),
      cpf: z.string().optional(),
      phone: z.string().optional(),
    })
    .optional(),
});

// 17. Schema de Cancelamento de Pagamento
export const CancelPaymentSchema = z.object({
  reason: z.string().optional(),
});

// 18. Schema de Reembolso de Pagamento
export const RefundPaymentSchema = z.object({
  reason: z.string().optional(),
});

// 19. Schema de Cadastro de Cliente (Storefront)
export const CustomerRegisterSchema = z.object({
  name: z.string().min(3, "Nome completo deve ter no mínimo 3 caracteres"),
  email: z.string().email("E-mail inválido"),
  cpf: z.string().refine(isValidCpfFormat, "CPF deve conter 11 dígitos numéricos"),
  phone: z.string().min(10, "Telefone deve conter DDD e número válido"),
  password: z.string().min(6, "A senha deve ter no mínimo 6 caracteres"),
});

// 20. Schema de Login de Cliente (Storefront)
export const CustomerLoginSchema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(1, "A senha é obrigatória"),
});

// 21. Schemas de Carrinho (Storefront)
export const AddToCartSchema = z.object({
  productId: z.string().min(1, "ID do produto é obrigatório"),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z.number().int().min(1, "Quantidade mínima é 1").max(99, "Quantidade máxima é 99").default(1),
});

export const UpdateCartItemSchema = z.object({
  productId: z.string().min(1, "ID do produto é obrigatório"),
  variantId: z.string().min(1).optional().nullable(),
  quantity: z.number().int().min(0, "Quantidade deve ser no mínimo 0").max(99, "Quantidade máxima é 99"),
});

// 22. Schema de Finalização de Checkout da Loja (Storefront)
export const StorefrontCheckoutSchema = z.object({
  customer: z.object({
    name: z.string().min(3, "Nome completo deve ter no mínimo 3 caracteres"),
    email: z.string().email("E-mail inválido"),
    cpf: z.string().refine(isValidCpfFormat, "CPF deve conter 11 dígitos numéricos"),
    phone: z.string().min(10, "Telefone deve conter DDD e número válido"),
  }),
  shippingAddress: z.object({
    street: z.string().min(2, "Rua/Logradouro é obrigatório"),
    number: z.string().min(1, "Número é obrigatório"),
    complement: z.string().optional().nullable(),
    neighborhood: z.string().min(2, "Bairro é obrigatório"),
    city: z.string().min(2, "Cidade é obrigatória"),
    state: z.string().length(2, "UF deve ter 2 caracteres"),
    postalCode: z.string().refine(isValidCepFormat, "CEP deve conter 8 dígitos"),
  }),
  items: z
    .array(
      z.object({
        productId: z.string().min(1, "ID de produto inválido"),
        variantId: z.string().min(1).optional().nullable(),
        quantity: z.number().int().positive("Quantidade deve ser maior que zero"),
      })
    )
    .min(1, "O carrinho deve conter pelo menos 1 item"),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "BOLETO", "TEST_MODE"]).default("PIX"),
  gatewayName: z.string().optional(),
  cardToken: z.string().optional(),
  installments: z.number().int().min(1).max(24).optional().default(1),
  paymentMethodId: z.string().optional(),
  issuerId: z.string().optional(),
  notes: z.string().optional().nullable(),
});

// 23. Schema de Criação Manual de Fulfillment
export const CreateFulfillmentSchema = z.object({
  orderId: z.string().min(1, "ID do pedido é obrigatório"),
});

// 24. Schema de Atualização de Rastreamento de Fulfillment
export const UpdateFulfillmentTrackingSchema = z.object({
  carrier: z.string().min(1, "Transportadora é obrigatória").optional().default("Correios"),
  trackingNumber: z.string().min(2, "Código de rastreamento é obrigatório"),
  trackingUrl: z.string().url("URL de rastreamento inválida").or(z.literal("")).optional().nullable(),
  shippedAt: z.string().optional(),
});

// 25. Schema de Alteração de Status do Fulfillment
export const UpdateFulfillmentStatusSchema = z.object({
  status: z.enum([
    "PENDING",
    "SUBMITTED",
    "ACKNOWLEDGED",
    "SHIPPED",
    "DELIVERED",
    "FAILED",
    "CANCELLED",
  ]),
  reason: z.string().optional(),
});

// 26. Schema de Webhook de Fornecedor
export const SupplierWebhookSchema = z.object({
  event: z.string().min(1, "Tipo de evento é obrigatório"),
  externalOrderId: z.string().optional(),
  supplierOrderNumber: z.string().optional(),
  trackingNumber: z.string().optional(),
  carrier: z.string().optional(),
  status: z.string().optional(),
  failureReason: z.string().optional(),
});

// 27. Schema de Reposição de Estoque (Restock)
export const RestockInputSchema = z.object({
  productId: z.string().min(1, "ID do produto é obrigatório"),
  variantId: z.string().optional().nullable(),
  quantity: z.number().int().positive("Quantidade para reposição deve ser maior que zero"),
  reason: z.string().optional(),
  unitCost: z.number().min(0).optional(),
  supplierId: z.string().optional().nullable(),
});

// 28. Schema de Ajuste Manual de Estoque (Adjustment / Correction)
export const StockAdjustmentSchema = z.object({
  productId: z.string().min(1, "ID do produto é obrigatório"),
  variantId: z.string().optional().nullable(),
  newBalance: z.number().int().min(0, "Novo saldo não pode ser negativo"),
  reason: z.string().min(3, "Motivo do ajuste é obrigatório (mínimo 3 caracteres)"),
  type: z.enum(["ADJUSTMENT", "CORRECTION"]).default("ADJUSTMENT"),
});

// 29. Schema de Filtros de Histórico de Movimentações
export const StockMovementFilterSchema = z.object({
  productId: z.string().optional(),
  variantId: z.string().optional(),
  orderId: z.string().optional(),
  type: z.enum(["SALE", "RESTOCK", "ADJUSTMENT", "RETURN", "CANCEL", "CORRECTION"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

// 30. Schema de Associação Produto x Fornecedor (SupplierProduct)
export const SupplierProductSchema = z.object({
  productId: z.string().uuid("ID de produto inválido"),
  supplierId: z.string().uuid("ID de fornecedor inválido"),
  externalProductId: z.string().optional().nullable(),
  externalSku: z.string().min(1, "SKU externo é obrigatório").optional().nullable(),
  supplierUrl: z.string().url("URL inválida").or(z.literal("")).optional().nullable(),
  supplierCost: z.number().min(0, "Custo do fornecedor não pode ser negativo"),
  supplierStock: z.number().int().min(0, "Estoque do fornecedor não pode ser negativo").default(0),
  isAvailable: z.boolean().default(true),
  metadataJson: z.record(z.any()).optional().nullable(),
});

// 31. Schema de Validação de Payload de Sincronização de Fornecedor
export const SupplierProductSyncPayloadSchema = z.object({
  costPrice: z.number().min(0, "Preço de custo não pode ser negativo"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo"),
  isAvailable: z.boolean().default(true),
  name: z.string().optional(),
  description: z.string().optional(),
  suggestedPrice: z.number().min(0).optional(),
});

// 32. Schema de Item Individual de Importação de Catálogo
export const CatalogImportItemSchema = z.object({
  name: z.string().min(2, "Nome do produto é obrigatório"),
  sku: z.string().min(2, "SKU é obrigatório"),
  slug: z.string().optional(),
  description: z.string().min(3, "Descrição é obrigatória").default("Sem descrição informada"),
  categoryName: z.string().optional().nullable(),
  supplierName: z.string().optional().nullable(),
  costPrice: z.number().min(0, "Custo não pode ser negativo"),
  sellingPrice: z.number().min(0, "Preço de venda não pode ser negativo"),
  stock: z.number().int().min(0, "Estoque não pode ser negativo").default(0),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
  brand: z.string().optional().nullable(),
  tags: z.array(z.string()).or(z.string()).optional(),
  externalSku: z.string().optional().nullable(),
  supplierUrl: z.string().url().or(z.literal("")).optional().nullable(),
  imageUrl: z.string().url().or(z.literal("")).optional().nullable(),
});

// 33. Schema de Pré-visualização de Importação (Preview)
export const CatalogImportPreviewInputSchema = z.object({
  format: z.enum(["CSV", "JSON"]),
  rawData: z.string().min(1, "Conteúdo da importação é obrigatório"),
  supplierId: z.string().optional().nullable(),
  defaultStatus: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"]).default("ACTIVE"),
});

// 34. Schema de Execução Efetiva de Importação (Commit)
export const CatalogImportCommitInputSchema = z.object({
  importBatchId: z.string().min(1, "ID do lote é obrigatório"),
  items: z.array(CatalogImportItemSchema).min(1, "Nenhum item válido para importar"),
  updateExisting: z.boolean().default(true),
  syncStockLedger: z.boolean().default(true),
});

// 35. Schema de Calculadora de Precificação Comercial
export const PricingCalculationRequestSchema = z.object({
  costPrice: z.number().min(0, "Custo não pode ser negativo"),
  targetMargin: z.number().min(0).max(99.99).optional(),
  targetMarkup: z.number().min(0).optional(),
  shippingCost: z.number().min(0).optional().default(0),
  gatewayFeePercentage: z.number().min(0).max(100).optional().default(0),
  taxPercentage: z.number().min(0).max(100).optional().default(0),
  adSpend: z.number().min(0).optional().default(0),
  otherCosts: z.number().min(0).optional().default(0),
  roundingRule: z.enum(["NONE", "PSYCHOLOGICAL_99", "PSYCHOLOGICAL_90", "ROUND_UP_INTEGER"]).default("NONE"),
  minPrice: z.number().min(0).optional(),
  maxPrice: z.number().min(0).optional(),
});

// 36. Schema de Publicação em Marketplace
export const MarketplacePublishRequestSchema = z.object({
  productId: z.string().uuid("ID de produto inválido"),
  channels: z.array(z.enum(["SHOPEE", "MERCADO_LIVRE", "AMAZON", "TEST"])).min(1, "Selecione pelo menos um canal"),
  customPrice: z.number().min(0).optional(),
  customStock: z.number().int().min(0).optional(),
});

// 37. Schema de Sincronização de Preço/Estoque em Marketplace
export const MarketplaceSyncRequestSchema = z.object({
  productId: z.string().uuid("ID de produto inválido"),
  channels: z.array(z.enum(["SHOPEE", "MERCADO_LIVRE", "AMAZON", "TEST"])).optional(),
  syncPrice: z.boolean().default(true),
  syncStock: z.boolean().default(true),
});

// 38. Schema de Filtros Avançados de Catálogo
export const CatalogFilterQuerySchema = z.object({
  q: z.string().optional(),
  categoryId: z.string().optional(),
  supplierId: z.string().optional(),
  status: z.enum(["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED", "ALL"]).default("ALL"),
  stockStatus: z.enum(["ALL", "IN_STOCK", "LOW_STOCK", "OUT_OF_STOCK"]).default("ALL"),
  minPrice: z.coerce.number().min(0).optional(),
  maxPrice: z.coerce.number().min(0).optional(),
  minMargin: z.coerce.number().optional(),
  maxMargin: z.coerce.number().optional(),
  syncStatus: z.enum(["ALL", "SYNCED", "ERROR", "NEVER_SYNCED"]).default("ALL"),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z.enum(["createdAt", "name", "sellingPrice", "costPrice", "stock", "margin"]).default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
});

// 39. Schema de Configuração e Credenciais de Integração de Fornecedor (Etapa 16)
export const SupplierIntegrationSaveSchema = z.object({
  provider: z.string().min(1, "Provedor é obrigatório").default("TEST"),
  credentials: z.record(z.any()).optional().nullable(),
  configuration: z.record(z.any()).optional().nullable(),
  status: z.enum(["NOT_CONFIGURED", "CONFIGURED", "ACTIVE", "ERROR", "DISABLED"]).optional(),
  apiKey: z.string().optional().nullable(),
  apiSecret: z.string().optional().nullable(),
  webhookSecret: z.string().optional().nullable(),
  baseUrl: z.string().url("URL Base deve ser uma URL válida").or(z.literal("")).optional().nullable(),
  authHeader: z.string().max(100).optional().nullable(),
  timeoutMs: z.coerce.number().int().min(1000, "Timeout mínimo é 1000ms (1s)").max(30000, "Timeout máximo é 30000ms (30s)").optional().nullable(),
  retryMaxAttempts: z.coerce.number().int().min(1, "Mínimo de 1 tentativa").max(5, "Máximo de 5 tentativas").optional().nullable(),
  isActive: z.boolean().optional().nullable(),
});



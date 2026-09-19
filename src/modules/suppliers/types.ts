import { FulfillmentStatus } from "@prisma/client";

export interface SupplierProductItem {
  externalId: string;
  sku: string;
  name: string;
  description?: string;
  costPrice: number;
  suggestedPrice?: number;
  stock: number;
  images?: string[];
  attributes?: Record<string, any>;
  category?: string;
}

export interface GetSupplierProductsInput {
  page?: number;
  limit?: number;
  query?: string;
  category?: string;
}

export interface GetSupplierProductsResult {
  success: boolean;
  products: SupplierProductItem[];
  total: number;
  page: number;
  hasMore: boolean;
  errorMessage?: string;
  rawResponse?: any;
}

export interface GetSupplierStockInput {
  skus: string[];
}

export interface SupplierStockItem {
  sku: string;
  stock: number;
  isAvailable: boolean;
}

export interface GetSupplierStockResult {
  success: boolean;
  items: SupplierStockItem[];
  errorMessage?: string;
  rawResponse?: any;
}

export interface GetSupplierPriceInput {
  skus: string[];
}

export interface SupplierPriceItem {
  sku: string;
  costPrice: number;
  currency: string;
}

export interface GetSupplierPriceResult {
  success: boolean;
  items: SupplierPriceItem[];
  errorMessage?: string;
  rawResponse?: any;
}

export interface SupplierItemInput {
  sku: string;
  name: string;
  quantity: number;
  unitCost: number;
  metadata?: Record<string, any>;
}

export interface SupplierRecipientInput {
  name: string;
  cpf?: string;
  phone?: string;
  email?: string;
  street: string;
  number?: string;
  complement?: string | null;
  neighborhood?: string;
  city: string;
  state: string;
  postalCode: string;
}

export interface SupplierCreateOrderInput {
  fulfillmentOrderId: string;
  orderNumber: string;
  supplierId: string;
  supplierName: string;
  recipient: SupplierRecipientInput;
  items: SupplierItemInput[];
  notes?: string | null;
}

export interface SupplierCreateOrderOutput {
  success: boolean;
  externalOrderId?: string;
  supplierOrderNumber?: string;
  status: "SUBMITTED" | "ACKNOWLEDGED" | "FAILED";
  rawResponse?: any;
  errorMessage?: string;
}

export interface GetSupplierOrderInput {
  externalOrderId: string;
  supplierOrderNumber?: string;
}

export interface GetSupplierOrderResult {
  success: boolean;
  externalOrderId: string;
  supplierOrderNumber?: string;
  status: FulfillmentStatus;
  items: Array<{
    sku: string;
    quantity: number;
    unitCost: number;
  }>;
  totalCost: number;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  rawResponse?: any;
  errorMessage?: string;
}

export interface SupplierGetStatusInput {
  externalOrderId: string;
  supplierOrderNumber?: string;
}

export interface SupplierOrderStatusOutput {
  success: boolean;
  status: FulfillmentStatus;
  trackingNumber?: string;
  carrier?: string;
  trackingUrl?: string;
  shippedAt?: Date;
  deliveredAt?: Date;
  rawResponse?: any;
  errorMessage?: string;
}

export interface GetSupplierTrackingInput {
  externalOrderId: string;
  trackingNumber?: string;
}

export interface GetSupplierTrackingResult {
  success: boolean;
  trackingNumber: string;
  carrier: string;
  status: "PENDING" | "IN_TRANSIT" | "OUT_FOR_DELIVERY" | "DELIVERED" | "EXCEPTION";
  trackingUrl?: string;
  events?: Array<{
    date: Date;
    description: string;
    location?: string;
  }>;
  shippedAt?: Date;
  deliveredAt?: Date;
  rawResponse?: any;
  errorMessage?: string;
}

export interface SupplierCancelOrderInput {
  externalOrderId: string;
  reason: string;
}

export interface SupplierCancelOrderOutput {
  success: boolean;
  cancelled: boolean;
  rawResponse?: any;
  errorMessage?: string;
}

export type SupplierCapability =
  | "PRODUCTS"
  | "STOCK"
  | "PRICE"
  | "ORDER_CREATE"
  | "ORDER_READ"
  | "ORDER_STATUS"
  | "TRACKING"
  | "ORDER_CANCEL"
  | "WEBHOOKS";

export const ALL_SUPPLIER_CAPABILITIES: readonly SupplierCapability[] = [
  "PRODUCTS",
  "STOCK",
  "PRICE",
  "ORDER_CREATE",
  "ORDER_READ",
  "ORDER_STATUS",
  "TRACKING",
  "ORDER_CANCEL",
  "WEBHOOKS",
] as const;

export interface SupplierProviderDefinition {
  key: string;
  name: string;
  description: string;
  capabilities: readonly SupplierCapability[];
  isAvailable: boolean;
  isMock?: boolean;
}

export type IntegrationErrorCategory =
  | "NOT_CONFIGURED"
  | "OPERATION_NOT_SUPPORTED"
  | "INVALID_CREDENTIALS"
  | "AUTHENTICATION_FAILED"
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "PROVIDER_UNAVAILABLE"
  | "INVALID_RESPONSE"
  | "PROVIDER_REJECTED"
  | "ORDER_NOT_FOUND"
  | "UNKNOWN_ERROR";

export interface TestConnectionResult {
  success: boolean;
  status: "CONNECTED" | "FAILED" | "NOT_CONFIGURED";
  message?: string;
  errorMessage?: string;
  category?: IntegrationErrorCategory;
  rawResponse?: any;
  latencyMs?: number;
}

export interface SupplierIntegrationContext {
  supplierId: string;
  provider: string;
  credentials?: Record<string, any> | null;
  configuration?: Record<string, any> | null;
}

export interface SupplierOperationAuditLog {
  provider: string;
  supplierId: string;
  operation: SupplierCapability | "TEST_CONNECTION";
  result: "SUCCESS" | "FAILURE";
  durationMs: number;
  timestamp: string;
  correlationId?: string;
  errorMessage?: string;
  category?: IntegrationErrorCategory;
}

/**
 * Classifica se um erro de integração é transitório (elegível a retry automático)
 * ou permanente (bloqueador, exigindo ação de operador).
 */
export function isTransientIntegrationError(category?: IntegrationErrorCategory | string): boolean {
  switch (category) {
    case "TIMEOUT":
    case "RATE_LIMITED":
    case "PROVIDER_UNAVAILABLE":
      return true;
    case "NOT_CONFIGURED":
    case "OPERATION_NOT_SUPPORTED":
    case "INVALID_CREDENTIALS":
    case "AUTHENTICATION_FAILED":
    case "INVALID_RESPONSE":
    case "PROVIDER_REJECTED":
    case "ORDER_NOT_FOUND":
    default:
      return false;
  }
}

/**
 * Verifica de forma segura se um adaptador de fornecedor suporta uma dada capacidade
 */
export function adapterSupportsCapability(
  adapter: { capabilities?: ReadonlySet<SupplierCapability> | readonly SupplierCapability[]; hasCapability?(cap: SupplierCapability): boolean },
  capability: SupplierCapability
): boolean {
  if (typeof adapter.hasCapability === "function") {
    return adapter.hasCapability(capability);
  }
  if (adapter.capabilities instanceof Set) {
    return adapter.capabilities.has(capability);
  }
  if (Array.isArray(adapter.capabilities)) {
    return adapter.capabilities.includes(capability);
  }
  // Se o adaptador não declarar capabilities, presume-se compatível por retrocompatibilidade
  return true;
}

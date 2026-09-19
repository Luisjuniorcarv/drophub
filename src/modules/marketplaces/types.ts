export type MarketplaceChannel = "SHOPEE" | "MERCADO_LIVRE" | "AMAZON" | "TEST";

export interface MarketplaceProductInput {
  productId: string;
  sku: string;
  title: string;
  description: string;
  price: number;
  stock: number;
  images: string[];
  category?: string;
  brand?: string;
  weightKg?: number;
  dimensionsCm?: {
    height: number;
    width: number;
    length: number;
  };
  attributes?: Record<string, string>;
}

export interface PublishProductInput {
  product: MarketplaceProductInput;
  channelSpecificConfig?: Record<string, any>;
}

export interface UpdateProductInput {
  externalListingId: string;
  sku: string;
  title?: string;
  description?: string;
  images?: string[];
  attributes?: Record<string, string>;
}

export interface UpdatePriceInput {
  externalListingId: string;
  sku: string;
  price: number;
  promotionalPrice?: number;
}

export interface UpdateStockInput {
  externalListingId: string;
  sku: string;
  stock: number;
}

export interface MarketplaceOperationResult {
  success: boolean;
  channel: MarketplaceChannel | string;
  externalListingId?: string;
  sku?: string;
  status: "ACTIVE" | "PENDING" | "REJECTED" | "UPDATED" | "FAILED";
  errorMessage?: string;
  rawResponse?: any;
}

export interface GetMarketplaceOrderInput {
  externalOrderId: string;
}

export interface MarketplaceOrderItem {
  sku: string;
  externalItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface GetMarketplaceOrderResult {
  success: boolean;
  channel: MarketplaceChannel | string;
  externalOrderId: string;
  channelOrderNumber?: string;
  status: "PENDING_PAYMENT" | "PAID" | "READY_TO_SHIP" | "SHIPPED" | "DELIVERED" | "CANCELLED";
  totalAmount: number;
  shippingAmount: number;
  recipient: {
    name: string;
    cpf?: string;
    phone?: string;
    city: string;
    state: string;
    postalCode: string;
    street: string;
    number?: string;
  };
  items: MarketplaceOrderItem[];
  errorMessage?: string;
  rawResponse?: any;
}

export interface SyncOrdersInput {
  since?: Date;
  status?: string;
  limit?: number;
}

export interface SyncMarketplaceOrdersResult {
  success: boolean;
  channel: MarketplaceChannel | string;
  orders: GetMarketplaceOrderResult[];
  totalSynced: number;
  hasMore: boolean;
  errorMessage?: string;
}

export interface MarketplaceSyncSummary {
  productId: string;
  sku: string;
  channelsAttempted: number;
  channelsSucceeded: number;
  results: MarketplaceOperationResult[];
}

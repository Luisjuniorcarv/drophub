import { StockMovementType } from "@prisma/client";

export interface DecrementStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  orderItemId?: string;
  unitPrice?: number;
  name?: string;
}

export interface DecrementStockParams {
  items: DecrementStockItem[];
  orderId: string;
  type?: StockMovementType;
  reason?: string;
  userId?: string;
}

export interface IncrementStockItem {
  productId: string;
  variantId?: string | null;
  quantity: number;
  orderItemId?: string;
  unitPrice?: number;
}

export interface IncrementStockParams {
  items: IncrementStockItem[];
  orderId?: string;
  type: "CANCEL" | "RETURN" | "RESTOCK";
  reason?: string;
  userId?: string;
  idempotencyKeyPrefix?: string;
}

export interface RestockParams {
  productId: string;
  variantId?: string | null;
  quantity: number;
  reason?: string;
  userId?: string;
  supplierId?: string | null;
  unitCost?: number;
}

export interface AdjustStockParams {
  productId: string;
  variantId?: string | null;
  newBalance: number;
  reason: string;
  type?: "ADJUSTMENT" | "CORRECTION";
  userId?: string;
}

export interface StockMovementFilter {
  productId?: string;
  variantId?: string;
  orderId?: string;
  type?: StockMovementType;
  page?: number;
  limit?: number;
}

export interface StockSummaryItem {
  id: string;
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  stock: number;
  isVariant: boolean;
  status: string;
  costPrice: number;
  sellingPrice: number;
}

export interface StockSummaryReport {
  totalSkus: number;
  totalUnitsInStock: number;
  lowStockCount: number; // <= 5
  outOfStockCount: number; // 0
  items: StockSummaryItem[];
}

export interface ReconciliationResult {
  productId: string;
  variantId?: string | null;
  name: string;
  sku: string;
  currentBalance: number;
  calculatedFromMovements: number;
  difference: number;
  isConsistent: boolean;
  totalMovementsCount: number;
  initialBaseQuantity?: number;
}

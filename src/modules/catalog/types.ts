import { ProductStatus } from "@prisma/client";
import { AdvancedPricingCalculation } from "@/lib/finance-math";

export interface CatalogProductItem {
  id: string;
  name: string;
  slug: string;
  sku: string;
  description: string;
  shortDescription?: string | null;
  categoryId?: string | null;
  category?: { id: string; name: string; slug: string } | null;
  supplierId?: string | null;
  supplier?: { id: string; name: string } | null;
  costPrice: number;
  sellingPrice: number;
  stock: number;
  status: ProductStatus;
  active: boolean;
  brand?: string | null;
  tags: string[];
  minPrice?: number | null;
  maxPrice?: number | null;
  targetMargin?: number | null;
  targetMarkup?: number | null;
  supplierUrl?: string | null;
  externalId?: string | null;
  images: Array<{
    id: string;
    url: string;
    altText?: string | null;
    isCover: boolean;
    position: number;
  }>;
  supplierProducts?: Array<{
    id: string;
    supplierId: string;
    supplierName: string;
    externalSku?: string | null;
    supplierCost: number;
    supplierStock: number;
    isAvailable: boolean;
    lastSyncedAt?: Date | null;
    lastSyncError?: string | null;
    supplierUrl?: string | null;
  }>;
  marketplaceListings?: Array<{
    id: string;
    channel: string;
    externalListingId?: string | null;
    status: string;
    marketplacePrice?: number | null;
    marketplaceStock?: number | null;
    lastSyncedAt?: Date | null;
    syncError?: string | null;
  }>;
  metrics: AdvancedPricingCalculation;
  salesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CatalogStatsSummary {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  draftProducts: number;
  archivedProducts: number;
  outOfStockCount: number;
  lowStockCount: number;
  noSupplierCount: number;
  noPriceCount: number;
  lowMarginCount: number;
  syncErrorsCount: number;
  neverSyncedCount: number;
}

export interface ImportValidationRow {
  rowNumber: number;
  data: any;
  isValid: boolean;
  errors: string[];
  isDuplicateInFile: boolean;
  existsInDb: boolean;
  action: "CREATE" | "UPDATE" | "INVALID" | "SKIP";
}

export interface ImportPreviewResult {
  importBatchId: string;
  totalRows: number;
  validCount: number;
  invalidCount: number;
  newCount: number;
  updateCount: number;
  duplicateInFileCount: number;
  rows: ImportValidationRow[];
  summary: {
    canCommit: boolean;
    sampleValid: any[];
    errors: Array<{ rowNumber: number; message: string }>;
  };
}

export interface ImportCommitResult {
  success: boolean;
  importBatchId: string;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  errors: Array<{ sku: string; error: string }>;
}

export interface PricingSimulationResult {
  costPrice: number;
  suggestedPrice: number;
  marginPercentage: number;
  markupPercentage: number;
  profit: number;
  roundingApplied: string;
  isWithinBounds: boolean;
  boundsWarning?: string;
  breakdown: AdvancedPricingCalculation;
}

export interface SupplierSyncResult {
  success: boolean;
  productId: string;
  supplierId: string;
  externalSku?: string;
  previousCost: number;
  newCost: number;
  previousStock: number;
  newStock: number;
  isAvailable: boolean;
  error?: string;
  syncedAt: Date;
}

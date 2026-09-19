import { prisma } from "@/lib/prisma";
import { ProductStatus } from "@prisma/client";
import { CatalogStatsSummary } from "./types";
import { calculatePricingMetrics } from "@/lib/finance-math";

export class CatalogStatsService {
  /**
   * Calcula métricas agregadas reais do catálogo para o dashboard
   */
  static async getCatalogStats(): Promise<CatalogStatsSummary> {
    const [
      totalProducts,
      activeProducts,
      inactiveProducts,
      draftProducts,
      archivedProducts,
      outOfStockCount,
      lowStockCount,
      noSupplierCount,
      noPriceCount,
      syncErrorsCount,
      neverSyncedCount,
      allProductsForMargin,
    ] = await Promise.all([
      prisma.product.count(),
      prisma.product.count({ where: { status: ProductStatus.ACTIVE } }),
      prisma.product.count({ where: { status: ProductStatus.INACTIVE } }),
      prisma.product.count({ where: { status: ProductStatus.DRAFT } }),
      prisma.product.count({ where: { status: ProductStatus.ARCHIVED } }),
      prisma.product.count({ where: { stock: { lte: 0 } } }),
      prisma.product.count({ where: { stock: { gt: 0, lte: 5 } } }),
      prisma.product.count({
        where: {
          supplierId: null,
          supplierProducts: { none: {} },
        },
      }),
      prisma.product.count({ where: { sellingPrice: { lte: 0 } } }),
      prisma.supplierProduct.count({
        where: { lastSyncError: { not: null } },
      }),
      prisma.supplierProduct.count({
        where: { lastSyncedAt: null },
      }),
      prisma.product.findMany({
        where: { status: ProductStatus.ACTIVE },
        select: { costPrice: true, sellingPrice: true },
      }),
    ]);

    // Calcula produtos com margem abaixo do mínimo saudável (< 15%)
    let lowMarginCount = 0;
    for (const p of allProductsForMargin) {
      const metrics = calculatePricingMetrics(Number(p.costPrice), Number(p.sellingPrice));
      if (metrics.marginPercentage < 15) {
        lowMarginCount++;
      }
    }

    return {
      totalProducts,
      activeProducts,
      inactiveProducts,
      draftProducts,
      archivedProducts,
      outOfStockCount,
      lowStockCount,
      noSupplierCount,
      noPriceCount,
      lowMarginCount,
      syncErrorsCount,
      neverSyncedCount,
    };
  }
}

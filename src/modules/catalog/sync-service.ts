import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { SupplierIntegrationService } from "@/modules/suppliers/service";
import { SupplierProductSyncPayloadSchema } from "@/lib/validators";
import { SupplierSyncResult } from "./types";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";

export class CatalogSyncService {
  /**
   * Sincroniza um SupplierProduct específico com o fornecedor externo
   */
  static async syncSupplierProduct(
    supplierProductId: string,
    options?: { updateProductCommercialStock?: boolean }
  ): Promise<SupplierSyncResult> {
    const sp = await prisma.supplierProduct.findUnique({
      where: { id: supplierProductId },
      include: {
        supplier: true,
        product: true,
      },
    });

    if (!sp) {
      throw new Error(`SupplierProduct com ID ${supplierProductId} não encontrado.`);
    }

    const previousCost = Number(sp.supplierCost);
    const previousStock = sp.supplierStock;
    const skuToQuery = sp.externalSku || sp.product.sku;

    try {
      // 1. Consultar preço e estoque em tempo real do fornecedor
      const [stockRes, priceRes] = await Promise.all([
        SupplierIntegrationService.checkRealtimeStock(sp.supplier.name, {
          skus: [skuToQuery],
        }),
        SupplierIntegrationService.checkRealtimePrice(sp.supplier.name, {
          skus: [skuToQuery],
        }),
      ]);

      if (!stockRes.success || !stockRes.items || stockRes.items.length === 0) {
        throw new Error(stockRes.errorMessage || "Fornecedor não retornou informações de estoque.");
      }

      if (!priceRes.success || !priceRes.items || priceRes.items.length === 0) {
        throw new Error(priceRes.errorMessage || "Fornecedor não retornou informações de preço.");
      }

      const stockItem = stockRes.items[0];
      const priceItem = priceRes.items[0];

      // 2. Validação rigorosa do payload externo (proteção contra dados corrompidos)
      const parseResult = SupplierProductSyncPayloadSchema.safeParse({
        costPrice: priceItem.costPrice,
        stock: stockItem.stock,
        isAvailable: stockItem.isAvailable ?? (stockItem.stock > 0),
      });

      if (!parseResult.success) {
        throw new Error(
          `Payload retornado pelo fornecedor contém dados corrompidos: ${JSON.stringify(
            parseResult.error.flatten().fieldErrors
          )}`
        );
      }

      const validated = parseResult.data;
      const now = new Date();

      // 3. Atualizar SupplierProduct de forma segura e transacional
      await prisma.$transaction(async (tx) => {
        await tx.supplierProduct.update({
          where: { id: supplierProductId },
          data: {
            supplierCost: new Decimal(validated.costPrice),
            supplierStock: validated.stock,
            isAvailable: validated.isAvailable,
            lastSyncedAt: now,
            lastSyncError: null,
          },
        });

        // Se solicitado, atualiza o estoque virtual de dropshipping do produto
        if (options?.updateProductCommercialStock) {
          await tx.product.update({
            where: { id: sp.productId },
            data: {
              stock: validated.stock,
            },
          });
        }

        // Publica evento de sincronização no outbox
        await publishDomainEvent(tx, {
          type: "catalog.supplier_synced",
          entityType: "SupplierProduct",
          entityId: sp.id,
          data: {
            productId: sp.productId,
            supplierId: sp.supplierId,
            sku: skuToQuery,
            previousCost,
            newCost: validated.costPrice,
            previousStock,
            newStock: validated.stock,
            isAvailable: validated.isAvailable,
            syncedAt: now.toISOString(),
          },
        });
      });

      return {
        success: true,
        productId: sp.productId,
        supplierId: sp.supplierId,
        externalSku: skuToQuery,
        previousCost,
        newCost: validated.costPrice,
        previousStock,
        newStock: validated.stock,
        isAvailable: validated.isAvailable,
        syncedAt: now,
      };
    } catch (err: any) {
      const errorMsg = err.message || "Erro desconhecido durante a sincronização com fornecedor.";
      const now = new Date();

      // PROTEÇÃO: NUNCA ZERAR DADOS LOCAIS VÁLIDOS EM CASO DE FALHA
      // Registra apenas o erro e preserva o último custo e estoque conhecidos
      await prisma.supplierProduct.update({
        where: { id: supplierProductId },
        data: {
          lastSyncedAt: now,
          lastSyncError: errorMsg,
        },
      });

      return {
        success: false,
        productId: sp.productId,
        supplierId: sp.supplierId,
        externalSku: skuToQuery,
        previousCost,
        newCost: previousCost,
        previousStock,
        newStock: previousStock,
        isAvailable: sp.isAvailable,
        error: errorMsg,
        syncedAt: now,
      };
    }
  }

  /**
   * Sincroniza todos os fornecedores associados a um produto
   */
  static async syncProductSuppliers(
    productId: string,
    options?: { updateProductCommercialStock?: boolean }
  ): Promise<SupplierSyncResult[]> {
    const supplierProducts = await prisma.supplierProduct.findMany({
      where: { productId },
    });

    if (supplierProducts.length === 0) {
      return [];
    }

    const results: SupplierSyncResult[] = [];
    for (const sp of supplierProducts) {
      const res = await this.syncSupplierProduct(sp.id, options);
      results.push(res);
    }

    return results;
  }
}

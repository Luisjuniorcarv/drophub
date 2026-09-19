import { prisma } from "@/lib/prisma";
import { FulfillmentStatus, OrderStatus } from "@prisma/client";
import {
  orchestratePaidOrderFulfillment,
  submitFulfillmentOrder,
  syncFulfillmentStatusFromSupplier,
} from "./service";

export interface FulfillmentWorkerOptions {
  batchSize?: number;
  syncSupplierStatus?: boolean;
}

export interface FulfillmentWorkerResult {
  timestamp: string;
  autoCreated: number;
  retried: number;
  retriesSucceeded: number;
  retriesFailed: number;
  synced: number;
  syncsUpdated: number;
  errors: Array<{ fulfillmentOrderId: string; error: string }>;
}

/**
 * Worker / Job de Processamento em Lote para Retentativas e Sincronizações de Fulfillment
 * Projetado para ser executado periodicamente (ex: a cada 1 minuto via cron ou worker daemon).
 */
export async function processFulfillmentJobs(
  options?: FulfillmentWorkerOptions
): Promise<FulfillmentWorkerResult> {
  const batchSize = Math.min(50, Math.max(1, options?.batchSize || 20));
  const syncSupplierStatus = options?.syncSupplierStatus !== false;
  const now = new Date();

  const errors: Array<{ fulfillmentOrderId: string; error: string }> = [];

  // 0. Auto-descoberta: Pedidos pagos que ainda não possuem ordens de fulfillment
  let autoCreatedCount = 0;
  const unfulfilledPaidOrders = await prisma.order.findMany({
    where: {
      status: OrderStatus.PAID,
      fulfillmentOrders: { none: {} },
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  for (const order of unfulfilledPaidOrders) {
    try {
      const res = await orchestratePaidOrderFulfillment(order.id);
      if (res.success) {
        autoCreatedCount += res.fulfillmentsCreated;
      }
    } catch (err: any) {
      errors.push({
        fulfillmentOrderId: `order_${order.id}`,
        error: err.message || "Erro ao orquestrar fulfillment do pedido pago",
      });
    }
  }

  // 1. Buscar fulfillments elegíveis para retentativa (PENDING ou FAILED que atingiram o horário de nextAttemptAt)
  const retryEligible = await prisma.fulfillmentOrder.findMany({
    where: {
      status: { in: [FulfillmentStatus.PENDING, FulfillmentStatus.FAILED] },
      supplierId: { not: null }, // Itens sem fornecedor não são enviados automaticamente
      attempts: { lt: 3 },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    take: batchSize,
    orderBy: { createdAt: "asc" },
  });

  let retriedCount = 0;
  let retriesSucceededCount = 0;
  let retriesFailedCount = 0;

  for (const fulfillment of retryEligible) {
    retriedCount++;
    try {
      const res = await submitFulfillmentOrder(fulfillment.id, { force: true });
      if (res.success) {
        retriesSucceededCount++;
      } else {
        retriesFailedCount++;
      }
    } catch (err: any) {
      retriesFailedCount++;
      errors.push({
        fulfillmentOrderId: fulfillment.id,
        error: err.message || "Erro desconhecido ao reprocessar fulfillment",
      });
    }
  }

  // 2. Sincronizar status dos pedidos que estão no fornecedor (SUBMITTED ou ACKNOWLEDGED)
  let syncedCount = 0;
  let syncsUpdatedCount = 0;

  if (syncSupplierStatus) {
    const syncEligible = await prisma.fulfillmentOrder.findMany({
      where: {
        status: { in: [FulfillmentStatus.SUBMITTED, FulfillmentStatus.ACKNOWLEDGED] },
        externalOrderId: { not: null },
      },
      take: batchSize,
      orderBy: { updatedAt: "asc" },
    });

    for (const fulfillment of syncEligible) {
      syncedCount++;
      try {
        const syncRes = await syncFulfillmentStatusFromSupplier(fulfillment.id);
        if (syncRes.updated) {
          syncsUpdatedCount++;
        }
      } catch (err: any) {
        errors.push({
          fulfillmentOrderId: fulfillment.id,
          error: err.message || "Erro ao sincronizar status com o fornecedor",
        });
      }
    }
  }

  return {
    timestamp: new Date().toISOString(),
    autoCreated: autoCreatedCount,
    retried: retriedCount,
    retriesSucceeded: retriesSucceededCount,
    retriesFailed: retriesFailedCount,
    synced: syncedCount,
    syncsUpdated: syncsUpdatedCount,
    errors,
  };
}

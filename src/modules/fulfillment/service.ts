import { prisma } from "@/lib/prisma";
import { Prisma, FulfillmentStatus, OrderStatus } from "@prisma/client";
import { getSupplierAdapter } from "./supplier-factory";
import { TestSupplierAdapter } from "./adapters/test-supplier-adapter";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import { CreateFulfillmentResult } from "./types";

class AsyncKeyedMutex {
  private queues = new Map<string, Promise<any>>();

  async runExclusive<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const currentPromise = this.queues.get(key) || Promise.resolve();
    let nextResolve: () => void;
    const nextPromise = new Promise<void>((resolve) => {
      nextResolve = resolve;
    });
    this.queues.set(key, nextPromise);

    try {
      await currentPromise;
      return await fn();
    } finally {
      nextResolve!();
      if (this.queues.get(key) === nextPromise) {
        this.queues.delete(key);
      }
    }
  }
}

const trackingMutex = new AsyncKeyedMutex();

/**
 * Cria de forma idempotente as ordens de fulfillment para um pedido pago,
 * agrupando os itens por fornecedor e capturando snapshots financeiros imutáveis.
 */
export async function createFulfillmentsForOrder(
  orderId: string,
  txClient?: Prisma.TransactionClient
): Promise<CreateFulfillmentResult> {
  const db = txClient || prisma;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: {
      customer: true,
      items: {
        include: {
          product: {
            include: { supplier: true },
          },
        },
      },
      fulfillmentOrders: true,
    },
  });

  if (!order) {
    throw new Error("ORDER_NOT_FOUND");
  }

  // Não permitir fulfillment para pedidos aguardando pagamento
  if (order.status === OrderStatus.AWAITING_PAYMENT) {
    throw new Error("ORDER_NOT_PAID");
  }

  if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.REFUNDED) {
    throw new Error("ORDER_CANCELLED_OR_REFUNDED");
  }

  // 1. Agrupar itens por Fornecedor (supplierId)
  const itemsBySupplier = new Map<string, typeof order.items>();

  for (const item of order.items) {
    const supplierId = item.product.supplierId || "UNASSIGNED_SUPPLIER";
    if (!itemsBySupplier.has(supplierId)) {
      itemsBySupplier.set(supplierId, []);
    }
    itemsBySupplier.get(supplierId)!.push(item);
  }

  const createdFulfillments: any[] = [];

  // 2. Executar criação transacional idempotente para cada fornecedor
  for (const [supplierKey, supplierItems] of itemsBySupplier.entries()) {
    const realSupplierId = supplierKey === "UNASSIGNED_SUPPLIER" ? null : supplierKey;

    // Checagem de idempotência: verificar se já existe fulfillment para este orderId e supplierId
    const existing = await db.fulfillmentOrder.findFirst({
      where: {
        orderId: order.id,
        supplierId: realSupplierId,
      },
      include: {
        items: true,
        supplier: true,
      },
    });

    if (existing) {
      createdFulfillments.push({
        id: existing.id,
        orderId: existing.orderId,
        supplierId: existing.supplierId,
        supplierName: existing.supplier?.name || (realSupplierId ? "Fornecedor Padrão" : "Sem Fornecedor Vinculado"),
        status: existing.status,
        itemsCount: existing.items.length,
      });
      continue;
    }

    const isUnassigned = realSupplierId === null;

    try {
      // Criar nova FulfillmentOrder com seus FulfillmentItems
      const fulfillment = await db.fulfillmentOrder.create({
        data: {
          orderId: order.id,
          supplierId: realSupplierId,
          status: FulfillmentStatus.PENDING,
          attempts: 0,
          maxAttempts: 3,
          failureReason: isUnassigned
            ? "Item sem fornecedor vinculado. Ação manual necessária no painel administrativo."
            : null,
          metadataJson: isUnassigned ? { isUnassignedSupplier: true, requiresManualAction: true } : undefined,
          items: {
            create: supplierItems.map((it) => ({
              orderItemId: it.id,
              productId: it.productId,
              variantId: it.variantId,
              sku: it.sku,
              name: it.name,
              quantity: it.quantity,
              unitCostSnapshot: it.unitCost, // Snapshot financeiro imutável
            })),
          },
          history: {
            create: {
              previousStatus: FulfillmentStatus.PENDING,
              newStatus: FulfillmentStatus.PENDING,
              reason: isUnassigned
                ? "Ordem de fulfillment gerada com alerta: Produto(s) sem fornecedor vinculado."
                : "Ordem de fulfillment gerada a partir do pedido pago.",
            },
          },
        },
        include: {
          items: true,
          supplier: true,
        },
      });

      // Publicar evento de domínio na Outbox
      await publishDomainEvent(db, {
        type: DOMAIN_EVENTS.FULFILLMENT_CREATED,
        entityType: "FulfillmentOrder",
        entityId: fulfillment.id,
        data: {
          fulfillmentOrderId: fulfillment.id,
          orderId: order.id,
          orderNumber: order.orderNumber,
          supplierId: fulfillment.supplierId,
          supplierName: fulfillment.supplier?.name || (realSupplierId ? "Fornecedor Padrão" : "Sem Fornecedor"),
          itemsCount: fulfillment.items.length,
          status: fulfillment.status,
          isUnassignedSupplier: isUnassigned,
        },
      });

      createdFulfillments.push({
        id: fulfillment.id,
        orderId: fulfillment.orderId,
        supplierId: fulfillment.supplierId,
        supplierName: fulfillment.supplier?.name || (realSupplierId ? "Fornecedor Padrão" : "Sem Fornecedor Vinculado"),
        status: fulfillment.status,
        itemsCount: fulfillment.items.length,
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
        const raceExisting = await db.fulfillmentOrder.findFirst({
          where: {
            orderId: order.id,
            supplierId: realSupplierId,
          },
          include: {
            items: true,
            supplier: true,
          },
        });
        if (raceExisting) {
          createdFulfillments.push({
            id: raceExisting.id,
            orderId: raceExisting.orderId,
            supplierId: raceExisting.supplierId,
            supplierName: raceExisting.supplier?.name || (realSupplierId ? "Fornecedor Padrão" : "Sem Fornecedor Vinculado"),
            status: raceExisting.status,
            itemsCount: raceExisting.items.length,
          });
          continue;
        }
      }
      throw err;
    }
  }

  // 3. Atualizar status do pedido pai para AWAITING_SUPPLIER condicionalmente se estiver em PAID
  const updateResult = await db.order.updateMany({
    where: { id: order.id, status: OrderStatus.PAID },
    data: { status: OrderStatus.AWAITING_SUPPLIER },
  });

  if (updateResult.count > 0) {
    await db.orderStatusHistory.create({
      data: {
        orderId: order.id,
        previousStatus: OrderStatus.PAID,
        newStatus: OrderStatus.AWAITING_SUPPLIER,
        reason: "Fulfillment iniciado. Pedido aguardando processamento do(s) fornecedor(es).",
      },
    });

    await publishDomainEvent(db, {
      type: DOMAIN_EVENTS.ORDER_AWAITING_SUPPLIER,
      entityType: "Order",
      entityId: order.id,
      data: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        status: OrderStatus.AWAITING_SUPPLIER,
        fulfillmentsCount: createdFulfillments.length,
      },
    });
  }

  return {
    fulfillments: createdFulfillments,
    totalFulfillments: createdFulfillments.length,
  };
}

/**
 * Orquestração automática de ponta a ponta quando um pedido é pago:
 * 1. Cria os fulfillments idempotentemente
 * 2. Submete automaticamente os fulfillments com fornecedores válidos
 * 3. Trata e isola itens sem fornecedor como exceções operacionais
 */
export async function orchestratePaidOrderFulfillment(orderId: string): Promise<{
  success: boolean;
  orderId: string;
  fulfillmentsCreated: number;
  fulfillmentsSubmitted: number;
  exceptionsCount: number;
}> {
  const fulfillmentResult = await createFulfillmentsForOrder(orderId);

  let submittedCount = 0;
  let exceptionsCount = 0;

  for (const f of fulfillmentResult.fulfillments) {
    if (!f.supplierId) {
      // Exceção operacional: item sem fornecedor, não submeter ao adapter
      exceptionsCount++;
      continue;
    }

    try {
      const submitRes = await submitFulfillmentOrder(f.id);
      if (submitRes.success) {
        submittedCount++;
      }
    } catch (err: any) {
      console.error(`[ORCHESTRATION_ERROR] Falha ao submeter fulfillment ${f.id}:`, err);
    }
  }

  return {
    success: true,
    orderId,
    fulfillmentsCreated: fulfillmentResult.totalFulfillments,
    fulfillmentsSubmitted: submittedCount,
    exceptionsCount,
  };
}

/**
 * Envia uma ordem de fulfillment para o fornecedor através do SupplierAdapter
 * Trata idempotência, concorrência e retentativas com backoff exponencial.
 */
export async function submitFulfillmentOrder(
  fulfillmentOrderId: string,
  options?: {
    force?: boolean;
    simulatedFailure?: boolean;
    failureMessage?: string;
  }
) {
  // 1. Buscar fulfillment com itens e dados de entrega
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: {
      order: {
        include: { customer: true },
      },
      supplier: true,
      items: true,
    },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  // Se o fulfillment não possui fornecedor atribuído, não tentar envio externo
  if (!fulfillment.supplierId && !fulfillment.supplier) {
    throw new Error("UNASSIGNED_SUPPLIER_CANNOT_BE_SUBMITTED");
  }

  // Se já foi enviado/reconhecido com sucesso e não é forçado, ignorar (idempotência)
  if (
    !options?.force &&
    (fulfillment.status === FulfillmentStatus.ACKNOWLEDGED ||
      fulfillment.status === FulfillmentStatus.SUBMITTED ||
      fulfillment.status === FulfillmentStatus.SHIPPED ||
      fulfillment.status === FulfillmentStatus.DELIVERED)
  ) {
    return {
      success: true,
      action: "ALREADY_SUBMITTED",
      fulfillment,
    };
  }

  if (fulfillment.status === FulfillmentStatus.CANCELLED) {
    throw new Error("FULFILLMENT_CANCELLED");
  }

  // 2. Resolver o adaptador adequado do fornecedor
  const adapter = options?.simulatedFailure
    ? new TestSupplierAdapter({
        shouldFail: true,
        failureErrorMessage: options.failureMessage || "Simulated supplier error",
      })
    : getSupplierAdapter(fulfillment.supplier?.name);

  const currentAttempt = fulfillment.attempts + 1;

  const shippingAddr = fulfillment.order.shippingAddress as any;
  const recipient = {
    name: fulfillment.order.customer.name,
    cpf: fulfillment.order.customer.cpf,
    phone: fulfillment.order.customer.phone,
    email: fulfillment.order.customer.email,
    street: shippingAddr?.street || "",
    number: shippingAddr?.number || "",
    complement: shippingAddr?.complement || null,
    neighborhood: shippingAddr?.neighborhood || "",
    city: shippingAddr?.city || "",
    state: shippingAddr?.state || "",
    postalCode: shippingAddr?.postalCode || "",
  };

  // 3. Executar chamada ao fornecedor fora de transações longas do banco
  const adapterResult = await adapter.createOrder({
    fulfillmentOrderId: fulfillment.id,
    orderNumber: fulfillment.order.orderNumber,
    supplierId: fulfillment.supplierId || "DEFAULT",
    supplierName: fulfillment.supplier?.name || "Fornecedor Padrão",
    recipient,
    items: fulfillment.items.map((it) => ({
      sku: it.sku,
      name: it.name,
      quantity: it.quantity,
      unitCost: Number(it.unitCostSnapshot),
    })),
    notes: fulfillment.order.notes,
  });

  // 4. Persistir resultado atomicamente no banco
  return await prisma.$transaction(async (tx) => {
    if (adapterResult.success) {
      const updated = await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          status: FulfillmentStatus.ACKNOWLEDGED,
          externalOrderId: adapterResult.externalOrderId || null,
          supplierOrderNumber: adapterResult.supplierOrderNumber || null,
          submittedAt: new Date(),
          acknowledgedAt: new Date(),
          failureReason: null,
          attempts: currentAttempt,
          metadataJson: adapterResult.rawResponse || undefined,
        },
        include: { items: true, supplier: true },
      });

      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentOrderId: fulfillment.id,
          previousStatus: fulfillment.status,
          newStatus: FulfillmentStatus.ACKNOWLEDGED,
          reason: `Ordem aceita pelo fornecedor ${adapter.name} (Ext ID: ${adapterResult.externalOrderId}).`,
        },
      });

      // Publicar eventos de domínio
      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.FULFILLMENT_SUBMITTED,
        entityType: "FulfillmentOrder",
        entityId: updated.id,
        data: {
          fulfillmentOrderId: updated.id,
          orderId: fulfillment.orderId,
          orderNumber: fulfillment.order.orderNumber,
          externalOrderId: updated.externalOrderId,
          supplierOrderNumber: updated.supplierOrderNumber,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.FULFILLMENT_ACKNOWLEDGED,
        entityType: "FulfillmentOrder",
        entityId: updated.id,
        data: {
          fulfillmentOrderId: updated.id,
          orderId: fulfillment.orderId,
          externalOrderId: updated.externalOrderId,
        },
      });

      // Avaliar status do Pedido Pai: se todos os fulfillments estiverem enviados/reconhecidos
      const allOrderFulfillments = await tx.fulfillmentOrder.findMany({
        where: { orderId: fulfillment.orderId },
      });

      const allSent = allOrderFulfillments.every(
        (f) =>
          f.status === FulfillmentStatus.ACKNOWLEDGED ||
          f.status === FulfillmentStatus.SUBMITTED ||
          f.status === FulfillmentStatus.SHIPPED ||
          f.status === FulfillmentStatus.DELIVERED
      );

      if (allSent && fulfillment.order.status !== OrderStatus.SENT_TO_SUPPLIER) {
        await tx.order.update({
          where: { id: fulfillment.orderId },
          data: { status: OrderStatus.SENT_TO_SUPPLIER },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: fulfillment.orderId,
            previousStatus: fulfillment.order.status,
            newStatus: OrderStatus.SENT_TO_SUPPLIER,
            reason: "Todas as ordens de fulfillment foram aceitas pelos respectivos fornecedores.",
          },
        });

        await publishDomainEvent(tx, {
          type: DOMAIN_EVENTS.ORDER_SENT_TO_SUPPLIER,
          entityType: "Order",
          entityId: fulfillment.orderId,
          data: {
            orderId: fulfillment.orderId,
            orderNumber: fulfillment.order.orderNumber,
            status: OrderStatus.SENT_TO_SUPPLIER,
          },
        });
      }

      return {
        success: true,
        action: "SUBMITTED_SUCCESSFULLY",
        fulfillment: updated,
      };
    } else {
      // Política de Retentativas e Threshold de Falha:
      // maxAttempts = 3 (1ª chamada inicial + 2 retentativas automáticas)
      // Tentativa 1 falha: attempts=1, nextDelay=1 min, status=PENDING
      // Tentativa 2 falha: attempts=2, nextDelay=5 min, status=PENDING
      // Tentativa 3 falha: attempts=3, nextDelay=null (isMaxAttemptsReached=true), status=FAILED
      const isMaxAttemptsReached = currentAttempt >= fulfillment.maxAttempts;
      const RETRY_BACKOFF_MINUTES = [1, 5, 15];
      const nextDelayMinutes = RETRY_BACKOFF_MINUTES[Math.min(currentAttempt - 1, RETRY_BACKOFF_MINUTES.length - 1)] || 5;
      const nextAttemptAt = isMaxAttemptsReached
        ? null
        : new Date(Date.now() + nextDelayMinutes * 60 * 1000);

      const updated = await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          status: isMaxAttemptsReached ? FulfillmentStatus.FAILED : FulfillmentStatus.PENDING,
          attempts: currentAttempt,
          nextAttemptAt,
          failureReason: adapterResult.errorMessage || "Erro na comunicação com o fornecedor",
        },
      });

      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentOrderId: fulfillment.id,
          previousStatus: fulfillment.status,
          newStatus: updated.status,
          reason: `Falha no envio (Tentativa ${currentAttempt}/${fulfillment.maxAttempts}): ${adapterResult.errorMessage}`,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.FULFILLMENT_FAILED,
        entityType: "FulfillmentOrder",
        entityId: updated.id,
        data: {
          fulfillmentOrderId: updated.id,
          orderId: fulfillment.orderId,
          attempt: currentAttempt,
          maxAttempts: fulfillment.maxAttempts,
          errorMessage: adapterResult.errorMessage,
        },
      });

      return {
        success: false,
        action: isMaxAttemptsReached ? "MAX_ATTEMPTS_REACHED" : "RETRY_SCHEDULED",
        fulfillment: updated,
        errorMessage: adapterResult.errorMessage,
      };
    }
  });
}

/**
 * Inserção deduplicada e append-only de eventos de rastreamento para um pacote (Shipment)
 */
export async function addTrackingEventSafe(
  shipmentId: string,
  eventData: {
    status: string;
    description: string;
    location?: string | null;
    timestamp?: Date;
    idempotencyKey?: string;
    rawDataJson?: any;
  },
  txClient?: Prisma.TransactionClient
) {
  const db = txClient || prisma;
  const eventDate = eventData.timestamp || new Date();
  const normalizedDesc = eventData.description.trim();
  const idempotencyKey =
    eventData.idempotencyKey ||
    `trk_${shipmentId}_${eventData.status}_${Buffer.from(normalizedDesc).toString("hex").slice(0, 32)}`;

  return await trackingMutex.runExclusive(shipmentId, async () => {
    // 1. Checagem prévia no banco
    const existingEvent = await db.tracking.findFirst({
      where: {
        OR: [
          { idempotencyKey },
          {
            shipmentId,
            status: eventData.status,
            description: normalizedDesc,
          },
        ],
      },
    });

    if (existingEvent) {
      return existingEvent;
    }

    // 2. Inserção atômica com garantia ACID no PostgreSQL
    try {
      return await db.tracking.create({
        data: {
          shipmentId,
          status: eventData.status,
          description: normalizedDesc,
          location: eventData.location || null,
          timestamp: eventDate,
          idempotencyKey,
          rawDataJson: eventData.rawDataJson || undefined,
        },
      });
    } catch (err: any) {
      if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
        const raceExisting = await db.tracking.findFirst({
          where: {
            OR: [
              { idempotencyKey },
              {
                shipmentId,
                status: eventData.status,
                description: normalizedDesc,
              },
            ],
          },
        });
        if (raceExisting) {
          return raceExisting;
        }
      }
      throw err;
    }
  });
}

/**
 * Atualiza o código de rastreamento de uma ordem de fulfillment e a transiciona para SHIPPED.
 * Se todos os fulfillments do pedido forem SHIPPED, transiciona o Pedido para SHIPPED.
 */
export async function updateFulfillmentTracking(
  fulfillmentOrderId: string,
  data: {
    carrier?: string;
    trackingNumber: string;
    trackingUrl?: string;
    shippedAt?: Date;
  },
  userId?: string
) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: { order: true, shipments: true },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  if (fulfillment.status === FulfillmentStatus.CANCELLED) {
    throw new Error("CANNOT_TRACK_CANCELLED_FULFILLMENT");
  }

  return await prisma.$transaction(async (tx) => {
    const shippedDate = data.shippedAt || new Date();

    // 1. Atualizar FulfillmentOrder
    const updatedFulfillment = await tx.fulfillmentOrder.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.SHIPPED,
        shippedAt: shippedDate,
      },
    });

    // 2. Criar ou atualizar Shipment vinculado
    let shipment = fulfillment.shipments[0];
    if (!shipment) {
      shipment = await tx.shipment.create({
        data: {
          orderId: fulfillment.orderId,
          fulfillmentOrderId: fulfillment.id,
          supplierId: fulfillment.supplierId,
          carrier: data.carrier || "Correios",
          trackingNumber: data.trackingNumber.trim(),
          trackingUrl:
            data.trackingUrl ||
            `https://rastreamento.correios.com.br/app/index.php?codigo=${data.trackingNumber.trim()}`,
          status: "SHIPPED",
          shippedAt: shippedDate,
        },
      });
    } else {
      shipment = await tx.shipment.update({
        where: { id: shipment.id },
        data: {
          carrier: data.carrier || shipment.carrier || "Correios",
          trackingNumber: data.trackingNumber.trim(),
          trackingUrl:
            data.trackingUrl ||
            `https://rastreamento.correios.com.br/app/index.php?codigo=${data.trackingNumber.trim()}`,
          status: "SHIPPED",
          shippedAt: shippedDate,
        },
      });
    }

    // 3. Inserir Evento de Rastreamento Deduplicado
    await addTrackingEventSafe(
      shipment.id,
      {
        status: "SHIPPED",
        description: `Objeto postado pela transportadora ${data.carrier || "Correios"}.`,
        timestamp: shippedDate,
      },
      tx
    );

    // 4. Registrar Histórico do Fulfillment
    await tx.fulfillmentHistory.create({
      data: {
        fulfillmentOrderId: fulfillment.id,
        previousStatus: fulfillment.status,
        newStatus: FulfillmentStatus.SHIPPED,
        reason: `Rastreamento atualizado: ${data.trackingNumber} (${data.carrier || "Correios"}).`,
        changedByUserId: userId || null,
      },
    });

    // 5. Publicar evento de domínio
    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.FULFILLMENT_SHIPPED,
      entityType: "FulfillmentOrder",
      entityId: fulfillment.id,
      data: {
        fulfillmentOrderId: fulfillment.id,
        orderId: fulfillment.orderId,
        trackingNumber: data.trackingNumber,
        carrier: data.carrier || "Correios",
        shippedAt: shippedDate.toISOString(),
      },
    });

    // 6. Avaliar Pedido Pai: Se TODOS os fulfillments estiverem SHIPPED ou DELIVERED
    const allOrderFulfillments = await tx.fulfillmentOrder.findMany({
      where: { orderId: fulfillment.orderId },
    });

    const allShipped = allOrderFulfillments.every(
      (f) =>
        f.status === FulfillmentStatus.SHIPPED ||
        f.status === FulfillmentStatus.DELIVERED
    );

    if (allShipped && fulfillment.order.status !== OrderStatus.SHIPPED) {
      await tx.order.update({
        where: { id: fulfillment.orderId },
        data: { status: OrderStatus.SHIPPED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: fulfillment.orderId,
          previousStatus: fulfillment.order.status,
          newStatus: OrderStatus.SHIPPED,
          reason: "Todos os pacotes de fornecedores foram despachados.",
          changedByUserId: userId || null,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_SHIPPED,
        entityType: "Order",
        entityId: fulfillment.orderId,
        data: {
          orderId: fulfillment.orderId,
          orderNumber: fulfillment.order.orderNumber,
          status: OrderStatus.SHIPPED,
        },
      });
    }

    return {
      fulfillment: updatedFulfillment,
      shipment,
    };
  });
}

/**
 * Consulta a API do fornecedor para sincronizar o status atualizado e código de rastreio
 */
export async function syncFulfillmentStatusFromSupplier(
  fulfillmentOrderId: string,
  userId?: string
): Promise<{
  success: boolean;
  fulfillmentOrderId: string;
  status: FulfillmentStatus;
  updated: boolean;
  trackingNumber?: string;
  message: string;
}> {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: {
      order: true,
      supplier: true,
      shipments: { include: { trackings: true } },
    },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  if (!fulfillment.externalOrderId) {
    return {
      success: true,
      fulfillmentOrderId,
      status: fulfillment.status,
      updated: false,
      message: "Fulfillment ainda não possui externalOrderId para sincronização.",
    };
  }

  if (
    fulfillment.status === FulfillmentStatus.DELIVERED ||
    fulfillment.status === FulfillmentStatus.CANCELLED
  ) {
    return {
      success: true,
      fulfillmentOrderId,
      status: fulfillment.status,
      updated: false,
      message: `Fulfillment já se encontra no estado terminal ${fulfillment.status}.`,
    };
  }

  const adapter = getSupplierAdapter(fulfillment.supplier?.name);
  const statusRes = await adapter.getOrderStatus({
    externalOrderId: fulfillment.externalOrderId,
    supplierOrderNumber: fulfillment.supplierOrderNumber || undefined,
  });

  if (!statusRes.success) {
    return {
      success: false,
      fulfillmentOrderId,
      status: fulfillment.status,
      updated: false,
      message: statusRes.errorMessage || "Erro ao consultar status no fornecedor.",
    };
  }

  const supplierStatus = statusRes.status;

  // Se o fornecedor marcou como SUBMITTED (em processamento inicial)
  if (
    supplierStatus === FulfillmentStatus.SUBMITTED &&
    fulfillment.status === FulfillmentStatus.PENDING
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          status: FulfillmentStatus.SUBMITTED,
          submittedAt: new Date(),
        },
      });

      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentOrderId: fulfillment.id,
          previousStatus: fulfillment.status,
          newStatus: FulfillmentStatus.SUBMITTED,
          reason: "Status sincronizado: Ordem recebida para processamento pelo fornecedor.",
          changedByUserId: userId || null,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.FULFILLMENT_SUBMITTED,
        entityType: "FulfillmentOrder",
        entityId: fulfillment.id,
        data: {
          fulfillmentOrderId: fulfillment.id,
          orderId: fulfillment.orderId,
          externalOrderId: fulfillment.externalOrderId,
        },
      });

      return f;
    });

    return {
      success: true,
      fulfillmentOrderId,
      status: FulfillmentStatus.SUBMITTED,
      updated: true,
      message: "Status sincronizado: Ordem em processamento no fornecedor.",
    };
  }

  // Se o fornecedor confirmou/reconheceu o recebimento (ACKNOWLEDGED)
  if (
    supplierStatus === FulfillmentStatus.ACKNOWLEDGED &&
    (fulfillment.status === FulfillmentStatus.PENDING ||
      fulfillment.status === FulfillmentStatus.SUBMITTED)
  ) {
    const updated = await prisma.$transaction(async (tx) => {
      const ackDate = new Date();
      const f = await tx.fulfillmentOrder.update({
        where: { id: fulfillment.id },
        data: {
          status: FulfillmentStatus.ACKNOWLEDGED,
          acknowledgedAt: ackDate,
        },
      });

      await tx.fulfillmentHistory.create({
        data: {
          fulfillmentOrderId: fulfillment.id,
          previousStatus: fulfillment.status,
          newStatus: FulfillmentStatus.ACKNOWLEDGED,
          reason: "Status sincronizado: Ordem confirmada e aceita pelo fornecedor.",
          changedByUserId: userId || null,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.FULFILLMENT_ACKNOWLEDGED,
        entityType: "FulfillmentOrder",
        entityId: fulfillment.id,
        data: {
          fulfillmentOrderId: fulfillment.id,
          orderId: fulfillment.orderId,
          externalOrderId: fulfillment.externalOrderId,
        },
      });

      const allFulfillments = await tx.fulfillmentOrder.findMany({
        where: { orderId: fulfillment.orderId },
      });

      const allSent = allFulfillments.every(
        (fo) =>
          fo.status === FulfillmentStatus.ACKNOWLEDGED ||
          fo.status === FulfillmentStatus.SUBMITTED ||
          fo.status === FulfillmentStatus.SHIPPED ||
          fo.status === FulfillmentStatus.DELIVERED
      );

      if (allSent && fulfillment.order.status !== OrderStatus.SENT_TO_SUPPLIER) {
        await tx.order.update({
          where: { id: fulfillment.orderId },
          data: { status: OrderStatus.SENT_TO_SUPPLIER },
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: fulfillment.orderId,
            previousStatus: fulfillment.order.status,
            newStatus: OrderStatus.SENT_TO_SUPPLIER,
            reason: "Todas as ordens de fulfillment foram aceitas pelos fornecedores após sincronização.",
            changedByUserId: userId || null,
          },
        });
      }

      return f;
    });

    return {
      success: true,
      fulfillmentOrderId,
      status: FulfillmentStatus.ACKNOWLEDGED,
      updated: true,
      message: "Status sincronizado: Ordem aceita e confirmada pelo fornecedor.",
    };
  }

  // Se o fornecedor despachou
  if (
    supplierStatus === FulfillmentStatus.SHIPPED &&
    fulfillment.status !== FulfillmentStatus.SHIPPED
  ) {
    const trackingCode = statusRes.trackingNumber || `TRK-${fulfillment.externalOrderId}`;
    await updateFulfillmentTracking(
      fulfillment.id,
      {
        carrier: statusRes.carrier || "Correios",
        trackingNumber: trackingCode,
        trackingUrl: statusRes.trackingUrl,
        shippedAt: statusRes.shippedAt || new Date(),
      },
      userId
    );

    return {
      success: true,
      fulfillmentOrderId,
      status: FulfillmentStatus.SHIPPED,
      updated: true,
      trackingNumber: trackingCode,
      message: "Status sincronizado: Pacote despachado pelo fornecedor.",
    };
  }

  // Se o fornecedor entregou
  if (supplierStatus === FulfillmentStatus.DELIVERED) {
    await markFulfillmentDelivered(fulfillment.id, userId);

    return {
      success: true,
      fulfillmentOrderId,
      status: FulfillmentStatus.DELIVERED,
      updated: true,
      message: "Status sincronizado: Entrega confirmada pelo fornecedor.",
    };
  }

  return {
    success: true,
    fulfillmentOrderId,
    status: fulfillment.status,
    updated: false,
    message: `Status atual mantido (${fulfillment.status}).`,
  };
}

/**
 * Marca uma ordem de fulfillment como entregue (DELIVERED).
 * Se todos os fulfillments do pedido estiverem entregues, transiciona o Pedido para DELIVERED.
 */
export async function markFulfillmentDelivered(
  fulfillmentOrderId: string,
  userId?: string
) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: { order: true },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  if (fulfillment.status === FulfillmentStatus.CANCELLED) {
    throw new Error("CANNOT_DELIVER_CANCELLED_FULFILLMENT");
  }

  return await prisma.$transaction(async (tx) => {
    const deliveredDate = new Date();

    const updatedFulfillment = await tx.fulfillmentOrder.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.DELIVERED,
        deliveredAt: deliveredDate,
      },
    });

    // Atualizar shipments vinculados
    await tx.shipment.updateMany({
      where: { fulfillmentOrderId: fulfillment.id },
      data: {
        status: "DELIVERED",
        deliveredAt: deliveredDate,
      },
    });

    await tx.fulfillmentHistory.create({
      data: {
        fulfillmentOrderId: fulfillment.id,
        previousStatus: fulfillment.status,
        newStatus: FulfillmentStatus.DELIVERED,
        reason: "Entrega confirmada pelo transportador/fornecedor.",
        changedByUserId: userId || null,
      },
    });

    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.FULFILLMENT_DELIVERED,
      entityType: "FulfillmentOrder",
      entityId: fulfillment.id,
      data: {
        fulfillmentOrderId: fulfillment.id,
        orderId: fulfillment.orderId,
        deliveredAt: deliveredDate.toISOString(),
      },
    });

    // Avaliar Pedido Pai: Se TODOS os fulfillments estiverem DELIVERED
    const allOrderFulfillments = await tx.fulfillmentOrder.findMany({
      where: { orderId: fulfillment.orderId },
    });

    const allDelivered = allOrderFulfillments.every(
      (f) => f.status === FulfillmentStatus.DELIVERED
    );

    if (allDelivered && fulfillment.order.status !== OrderStatus.DELIVERED) {
      await tx.order.update({
        where: { id: fulfillment.orderId },
        data: { status: OrderStatus.DELIVERED },
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: fulfillment.orderId,
          previousStatus: fulfillment.order.status,
          newStatus: OrderStatus.DELIVERED,
          reason: "Todos os pacotes de fornecedores foram entregues ao cliente.",
          changedByUserId: userId || null,
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_DELIVERED,
        entityType: "Order",
        entityId: fulfillment.orderId,
        data: {
          orderId: fulfillment.orderId,
          orderNumber: fulfillment.order.orderNumber,
          status: OrderStatus.DELIVERED,
        },
      });
    }

    return updatedFulfillment;
  });
}

/**
 * Cancela uma ordem de fulfillment com notificação ao fornecedor e registro de auditoria.
 */
export async function cancelFulfillmentOrder(
  fulfillmentOrderId: string,
  reason: string,
  userId?: string
) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: { supplier: true },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  if (fulfillment.status === FulfillmentStatus.DELIVERED) {
    throw new Error("CANNOT_CANCEL_DELIVERED_FULFILLMENT");
  }

  // Se já tiver sido aceito pelo fornecedor, acionar cancelamento no adapter
  if (fulfillment.externalOrderId) {
    const adapter = getSupplierAdapter(fulfillment.supplier?.name);
    await adapter.cancelOrder({
      externalOrderId: fulfillment.externalOrderId,
      reason,
    });
  }

  return await prisma.$transaction(async (tx) => {
    const cancelledDate = new Date();

    const updated = await tx.fulfillmentOrder.update({
      where: { id: fulfillment.id },
      data: {
        status: FulfillmentStatus.CANCELLED,
        cancelledAt: cancelledDate,
        failureReason: reason,
      },
    });

    await tx.fulfillmentHistory.create({
      data: {
        fulfillmentOrderId: fulfillment.id,
        previousStatus: fulfillment.status,
        newStatus: FulfillmentStatus.CANCELLED,
        reason: `Cancelamento: ${reason}`,
        changedByUserId: userId || null,
      },
    });

    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.FULFILLMENT_CANCELLED,
      entityType: "FulfillmentOrder",
      entityId: fulfillment.id,
      data: {
        fulfillmentOrderId: fulfillment.id,
        orderId: fulfillment.orderId,
        reason,
        cancelledAt: cancelledDate.toISOString(),
      },
    });

    return updated;
  });
}

/**
 * Troca assistida de fornecedor para um fulfillment (Multi-sourcing operacional)
 */
export async function switchFulfillmentSupplier(
  fulfillmentOrderId: string,
  newSupplierId: string,
  reason: string,
  userId?: string
) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
    include: {
      order: true,
      supplier: true,
      items: true,
    },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  if (
    fulfillment.order.status === OrderStatus.CANCELLED ||
    fulfillment.order.status === OrderStatus.REFUNDED
  ) {
    throw new Error("CANNOT_SWITCH_SUPPLIER_FOR_CANCELLED_OR_REFUNDED_ORDER");
  }

  if (fulfillment.status === FulfillmentStatus.CANCELLED) {
    throw new Error("CANNOT_SWITCH_SUPPLIER_FOR_CANCELLED_FULFILLMENT");
  }

  if (
    fulfillment.status === FulfillmentStatus.SHIPPED ||
    fulfillment.status === FulfillmentStatus.DELIVERED
  ) {
    throw new Error("CANNOT_SWITCH_SUPPLIER_FOR_SHIPPED_OR_DELIVERED_ORDER");
  }

  // Validar novo fornecedor
  const newSupplier = await prisma.supplier.findUnique({
    where: { id: newSupplierId },
  });

  if (!newSupplier) {
    throw new Error("NEW_SUPPLIER_NOT_FOUND");
  }

  // Se já havia sido submetido ao fornecedor anterior, solicitar cancelamento estrito
  if (fulfillment.externalOrderId) {
    const oldAdapter = getSupplierAdapter(fulfillment.supplier?.name);
    const cancelRes = await oldAdapter.cancelOrder({
      externalOrderId: fulfillment.externalOrderId,
      reason: `Substituição operacional de fornecedor: ${reason}`,
    });

    if (!cancelRes.success) {
      throw new Error(`FAILED_TO_CANCEL_PREVIOUS_SUPPLIER_ORDER: ${cancelRes.errorMessage || "Cancelamento recusado pelo fornecedor anterior"}`);
    }
  }

  const previousSupplierName = fulfillment.supplier?.name || "Nenhum";

  return await prisma.$transaction(async (tx) => {
    const updated = await tx.fulfillmentOrder.update({
      where: { id: fulfillment.id },
      data: {
        supplierId: newSupplier.id,
        status: FulfillmentStatus.PENDING,
        attempts: 0,
        nextAttemptAt: null,
        externalOrderId: null,
        supplierOrderNumber: null,
        failureReason: null,
      },
      include: {
        supplier: true,
        items: true,
      },
    });

    await tx.fulfillmentHistory.create({
      data: {
        fulfillmentOrderId: fulfillment.id,
        previousStatus: fulfillment.status,
        newStatus: FulfillmentStatus.PENDING,
        reason: `Troca de Fornecedor: de '${previousSupplierName}' para '${newSupplier.name}'. Motivo: ${reason}`,
        changedByUserId: userId || null,
      },
    });

    return updated;
  });
}

/**
 * Reprocessa manualmente um fulfillment que falhou
 */
export async function retryFulfillmentOrder(fulfillmentOrderId: string, userId?: string) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id: fulfillmentOrderId },
  });

  if (!fulfillment) {
    throw new Error("FULFILLMENT_NOT_FOUND");
  }

  await prisma.fulfillmentHistory.create({
    data: {
      fulfillmentOrderId: fulfillment.id,
      previousStatus: fulfillment.status,
      newStatus: FulfillmentStatus.PENDING,
      reason: "Retentativa manual iniciada pelo operador.",
      changedByUserId: userId || null,
    },
  });

  return await submitFulfillmentOrder(fulfillmentOrderId, { force: true });
}

/**
 * Consulta listagem paginada de ordens de fulfillment para o painel administrativo
 */
export async function listFulfillmentOrders(filters: {
  status?: string;
  orderId?: string;
  supplierId?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = Math.max(1, filters.page || 1);
  const limit = Math.min(50, Math.max(1, filters.limit || 15));
  const skip = (page - 1) * limit;

  const where: any = {};

  if (filters.status && filters.status !== "ALL") {
    where.status = filters.status as FulfillmentStatus;
  }

  if (filters.orderId) {
    where.orderId = filters.orderId;
  }

  if (filters.supplierId) {
    where.supplierId = filters.supplierId;
  }

  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { externalOrderId: { contains: q, mode: "insensitive" } },
      { supplierOrderNumber: { contains: q, mode: "insensitive" } },
      { supplier: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [total, items] = await Promise.all([
    prisma.fulfillmentOrder.count({ where }),
    prisma.fulfillmentOrder.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            customer: { select: { name: true, email: true } },
          },
        },
        supplier: {
          select: { id: true, name: true },
        },
        items: true,
        shipments: {
          select: { id: true, carrier: true, trackingNumber: true, trackingUrl: true, status: true },
        },
      },
    }),
  ]);

  return {
    data: items,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Consulta detalhes completos de uma ordem de fulfillment por ID
 */
export async function getFulfillmentOrderById(id: string) {
  const fulfillment = await prisma.fulfillmentOrder.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          customer: true,
        },
      },
      supplier: true,
      items: {
        include: {
          orderItem: true,
        },
      },
      shipments: {
        include: {
          trackings: {
            orderBy: { timestamp: "desc" },
          },
        },
      },
      history: {
        orderBy: { createdAt: "desc" },
      },
    },
  });

  return fulfillment;
}

/**
 * Consolida métricas em tempo real e alertas do Dashboard Operacional
 */
export async function getOperationalDashboardKPIs() {
  const [
    orderCounts,
    fulfillmentCounts,
    stuckFulfillmentsCount,
    unassignedSupplierCount,
    failedFulfillmentsCount,
    paidWithoutFulfillmentCount,
  ] = await Promise.all([
    // Pedidos agrupados por status
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Fulfillments agrupados por status
    prisma.fulfillmentOrder.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
    // Fulfillments travados (PENDING com mais de 3 tentativas ou criados há mais de 24h)
    prisma.fulfillmentOrder.count({
      where: {
        OR: [
          { status: FulfillmentStatus.FAILED },
          { attempts: { gte: 3 } },
        ],
      },
    }),
    // Fulfillments com produtos sem fornecedor
    prisma.fulfillmentOrder.count({
      where: {
        supplierId: null,
        status: { in: [FulfillmentStatus.PENDING, FulfillmentStatus.FAILED] },
      },
    }),
    // Fulfillments com falha
    prisma.fulfillmentOrder.count({
      where: { status: FulfillmentStatus.FAILED },
    }),
    // Pedidos pagos sem nenhuma ordem de fulfillment
    prisma.order.count({
      where: {
        status: OrderStatus.PAID,
        fulfillmentOrders: { none: {} },
      },
    }),
  ]);

  const ordersMap: Record<string, number> = {};
  for (const oc of orderCounts) {
    ordersMap[oc.status] = oc._count._all;
  }

  const fulfillmentsMap: Record<string, number> = {};
  for (const fc of fulfillmentCounts) {
    fulfillmentsMap[fc.status] = fc._count._all;
  }

  return {
    orders: {
      awaitingPayment: ordersMap[OrderStatus.AWAITING_PAYMENT] || 0,
      paid: ordersMap[OrderStatus.PAID] || 0,
      awaitingSupplier: ordersMap[OrderStatus.AWAITING_SUPPLIER] || 0,
      sentToSupplier: ordersMap[OrderStatus.SENT_TO_SUPPLIER] || 0,
      shipped: ordersMap[OrderStatus.SHIPPED] || 0,
      delivered: ordersMap[OrderStatus.DELIVERED] || 0,
      cancelled: ordersMap[OrderStatus.CANCELLED] || 0,
      refunded: ordersMap[OrderStatus.REFUNDED] || 0,
      total: Object.values(ordersMap).reduce((a, b) => a + b, 0),
    },
    fulfillments: {
      pending: fulfillmentsMap[FulfillmentStatus.PENDING] || 0,
      submitted: fulfillmentsMap[FulfillmentStatus.SUBMITTED] || 0,
      acknowledged: fulfillmentsMap[FulfillmentStatus.ACKNOWLEDGED] || 0,
      shipped: fulfillmentsMap[FulfillmentStatus.SHIPPED] || 0,
      delivered: fulfillmentsMap[FulfillmentStatus.DELIVERED] || 0,
      failed: fulfillmentsMap[FulfillmentStatus.FAILED] || 0,
      cancelled: fulfillmentsMap[FulfillmentStatus.CANCELLED] || 0,
      total: Object.values(fulfillmentsMap).reduce((a, b) => a + b, 0),
    },
    alerts: {
      stuckFulfillments: stuckFulfillmentsCount,
      unassignedSuppliers: unassignedSupplierCount,
      failedFulfillments: failedFulfillmentsCount,
      paidWithoutFulfillment: paidWithoutFulfillmentCount,
    },
  };
}

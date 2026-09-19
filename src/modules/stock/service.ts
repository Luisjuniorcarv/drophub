import { prisma } from "@/lib/prisma";
import { Prisma, StockMovementType } from "@prisma/client";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import crypto from "crypto";
import {
  DecrementStockParams,
  IncrementStockParams,
  RestockParams,
  AdjustStockParams,
  StockMovementFilter,
  StockSummaryReport,
  StockSummaryItem,
  ReconciliationResult,
} from "./types";

/**
 * Decrementa estoque atomicamente em nível de banco de dados (PostgreSQL)
 * Previne race condition e overselling com WHERE stock >= qty.
 * Utiliza RETURNING stock para garantir balanceBefore e balanceAfter exatos sob concorrência.
 * Grava auditoria imutável (append-only) em StockMovement com chave de idempotência.
 */
export async function decrementStockAtomic(
  client: Prisma.TransactionClient | typeof prisma,
  params: DecrementStockParams
) {
  const { items, orderId, type = "SALE", reason, userId } = params;

  // Validação segura de FK para orderId
  let validOrderId: string | null = null;
  if (orderId) {
    const orderExists = await client.order.findUnique({ where: { id: orderId } });
    if (orderExists) validOrderId = orderId;
  }

  for (const item of items) {
    const idempotencyKey = `SALE:${orderId}:${item.orderItemId || item.productId + (item.variantId ? `:${item.variantId}` : "")}`;

    // 1. Verificar idempotência para não decrementar duas vezes o mesmo pedido/item
    const existingMovement = await client.stockMovement.findUnique({
      where: { idempotencyKey },
    });

    if (existingMovement) {
      continue;
    }

    let validOrderItemId: string | null = null;
    if (item.orderItemId) {
      const itemExists = await client.orderItem.findUnique({ where: { id: item.orderItemId } });
      if (itemExists) validOrderItemId = item.orderItemId;
    }

    if (item.variantId) {
      // 2a. Produto com Variação
      const variant = await client.productVariant.findUnique({
        where: { id: item.variantId },
        include: { product: true },
      });

      if (!variant) {
        throw new Error(`VARIANT_NOT_FOUND:${item.variantId}`);
      }

      // Mutex de idempotência: Insere StockMovement com constraint única primeiro
      try {
        await client.stockMovement.create({
          data: {
            productId: variant.productId,
            variantId: variant.id,
            orderId: validOrderId,
            orderItemId: validOrderItemId,
            userId: userId || null,
            type: type as StockMovementType,
            quantity: -item.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            reason: reason || `Venda no Pedido ${orderId}`,
            idempotencyKey,
            metadataJson: {
              orderId,
              orderItemId: item.orderItemId,
              unitPrice: item.unitPrice,
              name: item.name || variant.name,
              sku: variant.sku,
            },
          },
        });
      } catch (err: any) {
        if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
          continue;
        }
        throw err;
      }

      // Executa UPDATE atômico com guard clause e RETURNING no PostgreSQL
      const rows = await client.$queryRaw<Array<{ stock: number }>>`
        UPDATE "ProductVariant"
        SET "stock" = "stock" - ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.variantId} AND "stock" >= ${item.quantity}
        RETURNING "stock"
      `;

      if (!rows || rows.length === 0) {
        // Rollback da movimentação criada se o estoque falhou
        await client.stockMovement.delete({ where: { idempotencyKey } }).catch(() => null);
        throw new Error(`INSUFFICIENT_STOCK_${variant.product?.name || variant.name}`);
      }

      const balanceAfter = rows[0].stock;
      const balanceBefore = balanceAfter + item.quantity;

      // Atualiza saldos exatos na movimentação
      await client.$executeRaw`
        UPDATE "StockMovement"
        SET "balanceBefore" = ${balanceBefore}, "balanceAfter" = ${balanceAfter}
        WHERE "idempotencyKey" = ${idempotencyKey}
      `;

      // Atualiza também o estoque do produto pai
      await client.$executeRaw`
        UPDATE "Product"
        SET "stock" = "stock" - ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${variant.productId} AND "stock" >= ${item.quantity}
      `;

      // Emissão de eventos de estoque baixo ou zerado
      if (balanceAfter === 0) {
        await publishDomainEvent(client, {
          type: DOMAIN_EVENTS.STOCK_OUT,
          entityType: "ProductVariant",
          entityId: variant.id,
          data: {
            productId: variant.productId,
            variantId: variant.id,
            sku: variant.sku,
            balance: 0,
            orderId,
          },
        });
      } else if (balanceAfter <= 5) {
        await publishDomainEvent(client, {
          type: DOMAIN_EVENTS.STOCK_LOW,
          entityType: "ProductVariant",
          entityId: variant.id,
          data: {
            productId: variant.productId,
            variantId: variant.id,
            sku: variant.sku,
            balance: balanceAfter,
            orderId,
          },
        });
      }
    } else {
      // 2b. Produto Simples (sem variação)
      const product = await client.product.findUnique({
        where: { id: item.productId },
      });

      if (!product) {
        throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
      }

      // Mutex de idempotência: Insere StockMovement com constraint única primeiro
      try {
        await client.stockMovement.create({
          data: {
            productId: product.id,
            variantId: null,
            orderId: validOrderId,
            orderItemId: validOrderItemId,
            userId: userId || null,
            type: type as StockMovementType,
            quantity: -item.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            reason: reason || `Venda no Pedido ${orderId}`,
            idempotencyKey,
            metadataJson: {
              orderId,
              orderItemId: item.orderItemId,
              unitPrice: item.unitPrice,
              name: item.name || product.name,
              sku: product.sku,
            },
          },
        });
      } catch (err: any) {
        if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
          continue;
        }
        throw err;
      }

      // Executa UPDATE atômico com guard clause e RETURNING no PostgreSQL
      const rows = await client.$queryRaw<Array<{ stock: number }>>`
        UPDATE "Product"
        SET "stock" = "stock" - ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.productId} AND "stock" >= ${item.quantity}
        RETURNING "stock"
      `;

      if (!rows || rows.length === 0) {
        // Rollback da movimentação criada se o estoque falhou
        await client.stockMovement.delete({ where: { idempotencyKey } }).catch(() => null);
        throw new Error(`INSUFFICIENT_STOCK_${product.name}`);
      }

      const balanceAfter = rows[0].stock;
      const balanceBefore = balanceAfter + item.quantity;

      // Atualiza saldos exatos na movimentação
      await client.$executeRaw`
        UPDATE "StockMovement"
        SET "balanceBefore" = ${balanceBefore}, "balanceAfter" = ${balanceAfter}
        WHERE "idempotencyKey" = ${idempotencyKey}
      `;

      // Emissão de eventos de estoque baixo ou zerado
      if (balanceAfter === 0) {
        await publishDomainEvent(client, {
          type: DOMAIN_EVENTS.STOCK_OUT,
          entityType: "Product",
          entityId: product.id,
          data: {
            productId: product.id,
            sku: product.sku,
            balance: 0,
            orderId,
          },
        });
      } else if (balanceAfter <= 5) {
        await publishDomainEvent(client, {
          type: DOMAIN_EVENTS.STOCK_LOW,
          entityType: "Product",
          entityId: product.id,
          data: {
            productId: product.id,
            sku: product.sku,
            balance: balanceAfter,
            orderId,
          },
        });
      }
    }
  }
}

/**
 * Incrementa estoque atomicamente no PostgreSQL (Cancelamentos, Devoluções ou Restock)
 * Garante idempotência operacional estrita sob concorrência via unique constraint em idempotencyKey.
 * Utiliza RETURNING stock para balanceBefore e balanceAfter 100% exatos.
 */
export async function incrementStockAtomic(
  client: Prisma.TransactionClient | typeof prisma,
  params: IncrementStockParams
) {
  const { items, orderId, type, reason, userId, idempotencyKeyPrefix } = params;

  let validOrderId: string | null = null;
  if (orderId) {
    const orderExists = await client.order.findUnique({ where: { id: orderId } });
    if (orderExists) validOrderId = orderId;
  }

  for (const item of items) {
    let idempotencyKey: string;
    if (orderId) {
      idempotencyKey = `${type}:${orderId}:${item.orderItemId || item.productId + (item.variantId ? `:${item.variantId}` : "")}`;
    } else {
      idempotencyKey = `${idempotencyKeyPrefix || type}:${item.productId}:${item.variantId || "main"}:${Date.now()}:${crypto.randomUUID()}`;
    }

    // Verificar se já foi retornado / incrementado (previne devolução duplicada)
    const existing = await client.stockMovement.findUnique({
      where: { idempotencyKey },
    });

    if (existing) {
      continue;
    }

    let validOrderItemId: string | null = null;
    if (item.orderItemId) {
      const itemExists = await client.orderItem.findUnique({ where: { id: item.orderItemId } });
      if (itemExists) validOrderItemId = item.orderItemId;
    }

    if (item.variantId) {
      // 1. Mutex de idempotência: Insere StockMovement primeiro
      try {
        await client.stockMovement.create({
          data: {
            productId: item.productId,
            variantId: item.variantId,
            orderId: validOrderId,
            orderItemId: validOrderItemId,
            userId: userId || null,
            type: type as StockMovementType,
            quantity: item.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            reason: reason || (type === "CANCEL" ? "Cancelamento de Pedido" : "Devolução de Estoque"),
            idempotencyKey,
            metadataJson: {
              orderId,
              orderItemId: item.orderItemId,
            },
          },
        });
      } catch (err: any) {
        if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
          // Já processado concorrentemente por outra chamada! Pula para evitar incremento duplo!
          continue;
        }
        throw err;
      }

      // 2. Executa UPDATE atômico com RETURNING no PostgreSQL
      const rows = await client.$queryRaw<Array<{ stock: number }>>`
        UPDATE "ProductVariant"
        SET "stock" = "stock" + ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.variantId}
        RETURNING "stock"
      `;

      if (!rows || rows.length === 0) {
        throw new Error(`VARIANT_NOT_FOUND:${item.variantId}`);
      }

      const balanceAfter = rows[0].stock;
      const balanceBefore = balanceAfter - item.quantity;

      // 3. Atualiza saldos exatos na movimentação gravada
      await client.$executeRaw`
        UPDATE "StockMovement"
        SET "balanceBefore" = ${balanceBefore}, "balanceAfter" = ${balanceAfter}
        WHERE "idempotencyKey" = ${idempotencyKey}
      `;

      await client.$executeRaw`
        UPDATE "Product"
        SET "stock" = "stock" + ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.productId}
      `;

      await publishDomainEvent(client, {
        type: type === "RESTOCK" ? DOMAIN_EVENTS.STOCK_RESTOCKED : DOMAIN_EVENTS.STOCK_RETURNED,
        entityType: "ProductVariant",
        entityId: item.variantId,
        data: {
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          balanceAfter,
          orderId,
          reason,
        },
      });
    } else {
      // 1. Mutex de idempotência: Insere StockMovement primeiro
      try {
        await client.stockMovement.create({
          data: {
            productId: item.productId,
            variantId: null,
            orderId: validOrderId,
            orderItemId: validOrderItemId,
            userId: userId || null,
            type: type as StockMovementType,
            quantity: item.quantity,
            balanceBefore: 0,
            balanceAfter: 0,
            reason: reason || (type === "CANCEL" ? "Cancelamento de Pedido" : "Devolução de Estoque"),
            idempotencyKey,
            metadataJson: {
              orderId,
              orderItemId: item.orderItemId,
            },
          },
        });
      } catch (err: any) {
        if (err.code === "P2002" || err.message?.includes("Unique constraint")) {
          // Já processado concorrentemente por outra chamada! Pula para evitar incremento duplo!
          continue;
        }
        throw err;
      }

      // 2. Executa UPDATE atômico com RETURNING no PostgreSQL
      const rows = await client.$queryRaw<Array<{ stock: number }>>`
        UPDATE "Product"
        SET "stock" = "stock" + ${item.quantity}, "updatedAt" = NOW()
        WHERE "id" = ${item.productId}
        RETURNING "stock"
      `;

      if (!rows || rows.length === 0) {
        throw new Error(`PRODUCT_NOT_FOUND:${item.productId}`);
      }

      const balanceAfter = rows[0].stock;
      const balanceBefore = balanceAfter - item.quantity;

      // 3. Atualiza saldos exatos na movimentação gravada
      await client.$executeRaw`
        UPDATE "StockMovement"
        SET "balanceBefore" = ${balanceBefore}, "balanceAfter" = ${balanceAfter}
        WHERE "idempotencyKey" = ${idempotencyKey}
      `;

      await publishDomainEvent(client, {
        type: type === "RESTOCK" ? DOMAIN_EVENTS.STOCK_RESTOCKED : DOMAIN_EVENTS.STOCK_RETURNED,
        entityType: "Product",
        entityId: item.productId,
        data: {
          productId: item.productId,
          quantity: item.quantity,
          balanceAfter,
          orderId,
          reason,
        },
      });
    }
  }
}

/**
 * Reposição de Estoque (RESTOCK) com registro de custo unitário e fornecedor
 */
export async function restockProduct(params: RestockParams) {
  const { productId, variantId, quantity, reason, userId, supplierId, unitCost } = params;

  if (quantity <= 0) {
    throw new Error("QUANTITY_MUST_BE_POSITIVE");
  }

  return await prisma.$transaction(async (tx) => {
    let balanceBefore = 0;
    let balanceAfter = 0;
    let sku = "";
    let name = "";

    if (variantId) {
      const variant = await tx.productVariant.findUnique({
        where: { id: variantId },
        include: { product: true },
      });

      if (!variant) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      sku = variant.sku;
      name = `${variant.product.name} (${variant.name})`;

      const rows = await tx.$queryRaw<Array<{ stock: number }>>`
        UPDATE "ProductVariant"
        SET "stock" = "stock" + ${quantity}, "updatedAt" = NOW()
        WHERE "id" = ${variantId}
        RETURNING "stock"
      `;

      balanceAfter = rows[0].stock;
      balanceBefore = balanceAfter - quantity;

      await tx.$executeRaw`
        UPDATE "Product"
        SET "stock" = "stock" + ${quantity}, "updatedAt" = NOW()
        WHERE "id" = ${productId}
      `;
    } else {
      const product = await tx.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      sku = product.sku;
      name = product.name;

      const rows = await tx.$queryRaw<Array<{ stock: number }>>`
        UPDATE "Product"
        SET "stock" = "stock" + ${quantity}, "updatedAt" = NOW()
        WHERE "id" = ${productId}
        RETURNING "stock"
      `;

      balanceAfter = rows[0].stock;
      balanceBefore = balanceAfter - quantity;
    }

    const idempotencyKey = `RESTOCK:${productId}:${variantId || "main"}:${Date.now()}:${crypto.randomUUID()}`;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        variantId: variantId || null,
        userId: userId || null,
        type: StockMovementType.RESTOCK,
        quantity,
        balanceBefore,
        balanceAfter,
        reason: reason || "Reposição de estoque via Painel Administrativo",
        idempotencyKey,
        metadataJson: {
          supplierId: supplierId || null,
          unitCost: unitCost || null,
          sku,
          name,
        },
      },
    });

    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.STOCK_RESTOCKED,
      entityType: variantId ? "ProductVariant" : "Product",
      entityId: variantId || productId,
      data: {
        productId,
        variantId: variantId || null,
        quantity,
        balanceBefore,
        balanceAfter,
        reason,
        unitCost,
        supplierId,
      },
    });

    return {
      movement,
      balanceBefore,
      balanceAfter,
      newBalance: balanceAfter,
    };
  });
}

/**
 * Ajuste Manual de Estoque (ADJUSTMENT ou CORRECTION) com bloqueio pessimista (FOR UPDATE)
 */
export async function adjustStock(params: AdjustStockParams) {
  const { productId, variantId, newBalance, reason, type = "ADJUSTMENT", userId } = params;

  if (newBalance < 0) {
    throw new Error("NEW_BALANCE_CANNOT_BE_NEGATIVE");
  }

  return await prisma.$transaction(async (tx) => {
    let balanceBefore = 0;
    let sku = "";
    let name = "";

    if (variantId) {
      // Bloqueio de linha FOR UPDATE para leitura consistente sob concorrência
      const vRows = await tx.$queryRaw<Array<{ id: string; stock: number; name: string; sku: string; productId: string }>>`
        SELECT "id", "stock", "name", "sku", "productId" FROM "ProductVariant"
        WHERE "id" = ${variantId}
        FOR UPDATE
      `;

      if (!vRows || vRows.length === 0) {
        throw new Error("VARIANT_NOT_FOUND");
      }

      balanceBefore = vRows[0].stock;
      sku = vRows[0].sku;
      name = vRows[0].name;
      const diff = newBalance - balanceBefore;

      await tx.$executeRaw`
        UPDATE "ProductVariant"
        SET "stock" = ${newBalance}, "updatedAt" = NOW()
        WHERE "id" = ${variantId}
      `;

      if (diff !== 0) {
        await tx.$executeRaw`
          UPDATE "Product"
          SET "stock" = "stock" + ${diff}, "updatedAt" = NOW()
          WHERE "id" = ${productId}
        `;
      }
    } else {
      // Bloqueio de linha FOR UPDATE para leitura consistente sob concorrência
      const pRows = await tx.$queryRaw<Array<{ id: string; stock: number; name: string; sku: string }>>`
        SELECT "id", "stock", "name", "sku" FROM "Product"
        WHERE "id" = ${productId}
        FOR UPDATE
      `;

      if (!pRows || pRows.length === 0) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      balanceBefore = pRows[0].stock;
      sku = pRows[0].sku;
      name = pRows[0].name;

      await tx.$executeRaw`
        UPDATE "Product"
        SET "stock" = ${newBalance}, "updatedAt" = NOW()
        WHERE "id" = ${productId}
      `;
    }

    const diff = newBalance - balanceBefore;
    const idempotencyKey = `ADJUST:${productId}:${variantId || "main"}:${Date.now()}:${crypto.randomUUID()}`;

    const movement = await tx.stockMovement.create({
      data: {
        productId,
        variantId: variantId || null,
        userId: userId || null,
        type: type as StockMovementType,
        quantity: diff,
        balanceBefore,
        balanceAfter: newBalance,
        reason: reason || "Ajuste manual de inventário",
        idempotencyKey,
        metadataJson: {
          sku,
          name,
          diff,
        },
      },
    });

    await publishDomainEvent(tx, {
      type: DOMAIN_EVENTS.STOCK_ADJUSTED,
      entityType: variantId ? "ProductVariant" : "Product",
      entityId: variantId || productId,
      data: {
        productId,
        variantId: variantId || null,
        diff,
        balanceBefore,
        balanceAfter: newBalance,
        reason,
      },
    });

    return {
      movement,
      balanceBefore,
      balanceAfter: newBalance,
      newBalance,
      diff,
    };
  });
}

/**
 * Consulta histórico paginado de movimentações de estoque
 */
export async function listStockMovements(filters: StockMovementFilter) {
  const { productId, variantId, orderId, type, page = 1, limit = 50 } = filters;
  const skip = (page - 1) * limit;

  const where: Prisma.StockMovementWhereInput = {};
  if (productId) where.productId = productId;
  if (variantId) where.variantId = variantId;
  if (orderId) where.orderId = orderId;
  if (type) where.type = type;

  const [total, movements] = await Promise.all([
    prisma.stockMovement.count({ where }),
    prisma.stockMovement.findMany({
      where,
      include: {
        product: { select: { id: true, name: true, sku: true } },
        variant: { select: { id: true, name: true, sku: true } },
        order: { select: { id: true, orderNumber: true } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    movements: movements.map((m) => ({
      id: m.id,
      productId: m.productId,
      productName: m.product?.name || "Produto",
      variantId: m.variantId,
      variantName: m.variant?.name || null,
      sku: m.variant?.sku || m.product?.sku || "",
      orderId: m.orderId,
      orderNumber: m.order?.orderNumber || null,
      userId: m.userId,
      userName: m.user?.name || (m.userId ? "Usuário" : "Sistema / Checkout"),
      type: m.type,
      quantity: m.quantity,
      balanceBefore: m.balanceBefore,
      balanceAfter: m.balanceAfter,
      reason: m.reason,
      idempotencyKey: m.idempotencyKey,
      metadata: m.metadataJson,
      createdAt: m.createdAt,
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/**
 * Reconciliação do estoque atual com o histórico de movimentações (Auditoria de Integridade)
 */
export async function reconcileStock(
  productId: string,
  variantId?: string | null
): Promise<ReconciliationResult> {
  let currentBalance = 0;
  let name = "";
  let sku = "";

  if (variantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: variantId },
      include: { product: true },
    });
    if (!variant) throw new Error("VARIANT_NOT_FOUND");
    currentBalance = variant.stock;
    name = `${variant.product.name} (${variant.name})`;
    sku = variant.sku;
  } else {
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) throw new Error("PRODUCT_NOT_FOUND");
    currentBalance = product.stock;
    name = product.name;
    sku = product.sku;
  }

  const movements = await prisma.stockMovement.findMany({
    where: {
      productId,
      variantId: variantId || null,
    },
    orderBy: { createdAt: "asc" },
  });

  const calculatedFromMovements = movements.reduce((acc, m) => acc + m.quantity, 0);

  let isConsistent = true;
  let difference = 0;

  if (movements.length > 0) {
    const lastMovement = movements[movements.length - 1];
    const initialBase = movements[0].balanceBefore;
    const expectedFromHistory = initialBase + calculatedFromMovements;

    isConsistent = lastMovement.balanceAfter === currentBalance && expectedFromHistory === currentBalance;
    difference = currentBalance - lastMovement.balanceAfter;
  } else {
    isConsistent = true;
    difference = 0;
  }

  return {
    productId,
    variantId: variantId || null,
    name,
    sku,
    currentBalance,
    calculatedFromMovements,
    difference,
    isConsistent,
    totalMovementsCount: movements.length,
  };
}

/**
 * Retorna visão executiva de estoque (KPIs e listagem consolidada)
 */
export async function getStockSummary(): Promise<StockSummaryReport> {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: {
      variants: { where: { active: true } },
    },
    orderBy: { name: "asc" },
  });

  const items: StockSummaryItem[] = [];
  let totalUnitsInStock = 0;
  let lowStockCount = 0;
  let outOfStockCount = 0;

  for (const p of products) {
    if (p.variants.length > 0) {
      for (const v of p.variants) {
        items.push({
          id: v.id,
          productId: p.id,
          variantId: v.id,
          name: `${p.name} - ${v.name}`,
          sku: v.sku,
          stock: v.stock,
          isVariant: true,
          status: p.status,
          costPrice: Number(v.costPrice),
          sellingPrice: Number(v.sellingPrice),
        });

        totalUnitsInStock += v.stock;
        if (v.stock === 0) outOfStockCount++;
        else if (v.stock <= 5) lowStockCount++;
      }
    } else {
      items.push({
        id: p.id,
        productId: p.id,
        variantId: null,
        name: p.name,
        sku: p.sku,
        stock: p.stock,
        isVariant: false,
        status: p.status,
        costPrice: Number(p.costPrice),
        sellingPrice: Number(p.sellingPrice),
      });

      totalUnitsInStock += p.stock;
      if (p.stock === 0) outOfStockCount++;
      else if (p.stock <= 5) lowStockCount++;
    }
  }

  return {
    totalSkus: items.length,
    totalUnitsInStock,
    lowStockCount,
    outOfStockCount,
    items,
  };
}

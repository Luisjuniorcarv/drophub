import { prisma } from "@/lib/prisma";

export class CatalogAuditService {
  /**
   * Registra uma alteração de campo em um produto
   */
  static async recordChange(params: {
    productId: string;
    field: "SELLING_PRICE" | "COST_PRICE" | "STATUS" | "SUPPLIER" | "STOCK" | "SKU";
    oldValue?: string | null;
    newValue?: string | null;
    changedByUserId?: string | null;
    reason?: string | null;
    tx?: any;
  }) {
    const client = params.tx || prisma;

    if (params.oldValue === params.newValue) {
      return; // Nenhuma alteração real
    }

    return await client.productAuditLog.create({
      data: {
        productId: params.productId,
        field: params.field,
        oldValue: params.oldValue ? String(params.oldValue) : null,
        newValue: params.newValue ? String(params.newValue) : null,
        changedByUserId: params.changedByUserId || null,
        reason: params.reason || null,
      },
    });
  }

  /**
   * Consulta o histórico de alterações de um produto
   */
  static async getProductAuditHistory(productId: string) {
    return await prisma.productAuditLog.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Consulta o histórico global de auditoria do catálogo com paginação
   */
  static async getGlobalAuditHistory(params: {
    productId?: string;
    field?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 50));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.productId) where.productId = params.productId;
    if (params.field) where.field = params.field;

    const [total, logs] = await Promise.all([
      prisma.productAuditLog.count({ where }),
      prisma.productAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          product: { select: { id: true, name: true, sku: true } },
          user: { select: { id: true, name: true, email: true } },
        },
      }),
    ]);

    return {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      logs,
    };
  }
}

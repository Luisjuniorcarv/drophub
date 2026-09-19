import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { ProductSchema } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";
import { calculatePricingMetrics } from "@/lib/finance-math";
import { ProductStatus } from "@prisma/client";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim();
    const categoryId = searchParams.get("categoryId");
    const supplierId = searchParams.get("supplierId");
    const statusParam = searchParams.get("status");
    const stockStatus = searchParams.get("stockStatus"); // ALL, IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    const minPrice = searchParams.get("minPrice") ? Number(searchParams.get("minPrice")) : undefined;
    const maxPrice = searchParams.get("maxPrice") ? Number(searchParams.get("maxPrice")) : undefined;
    const minMargin = searchParams.get("minMargin") ? Number(searchParams.get("minMargin")) : undefined;
    const maxMargin = searchParams.get("maxMargin") ? Number(searchParams.get("maxMargin")) : undefined;
    const syncStatus = searchParams.get("syncStatus"); // ALL, SYNCED, ERROR, NEVER_SYNCED
    const sortBy = searchParams.get("sortBy") || "createdAt";
    const sortOrder = (searchParams.get("sortOrder") || "desc").toLowerCase() === "asc" ? "asc" : "desc";

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(100, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (q) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { sku: { contains: q, mode: "insensitive" } },
        { slug: { contains: q, mode: "insensitive" } },
        { brand: { contains: q, mode: "insensitive" } },
        { supplierProducts: { some: { externalSku: { contains: q, mode: "insensitive" } } } },
      ];
    }

    if (categoryId && categoryId !== "ALL") where.categoryId = categoryId;
    if (supplierId && supplierId !== "ALL") where.supplierId = supplierId;

    if (statusParam && statusParam !== "ALL") {
      where.status = statusParam as ProductStatus;
    }

    if (stockStatus === "IN_STOCK") {
      where.stock = { gt: 0 };
    } else if (stockStatus === "LOW_STOCK") {
      where.stock = { gt: 0, lte: 5 };
    } else if (stockStatus === "OUT_OF_STOCK") {
      where.stock = { lte: 0 };
    }

    if (minPrice !== undefined && !isNaN(minPrice)) {
      where.sellingPrice = { ...(where.sellingPrice || {}), gte: new Decimal(minPrice) };
    }
    if (maxPrice !== undefined && !isNaN(maxPrice)) {
      where.sellingPrice = { ...(where.sellingPrice || {}), lte: new Decimal(maxPrice) };
    }

    if (syncStatus === "ERROR") {
      where.supplierProducts = { some: { lastSyncError: { not: null } } };
    } else if (syncStatus === "SYNCED") {
      where.supplierProducts = { some: { lastSyncedAt: { not: null }, lastSyncError: null } };
    } else if (syncStatus === "NEVER_SYNCED") {
      where.supplierProducts = { some: { lastSyncedAt: null } };
    }

    let orderBy: any = { createdAt: "desc" };
    if (sortBy === "name") orderBy = { name: sortOrder };
    else if (sortBy === "sellingPrice") orderBy = { sellingPrice: sortOrder };
    else if (sortBy === "costPrice") orderBy = { costPrice: sortOrder };
    else if (sortBy === "stock") orderBy = { stock: sortOrder };
    else if (sortBy === "createdAt") orderBy = { createdAt: sortOrder };

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: { select: { id: true, name: true, slug: true } },
          supplier: { select: { id: true, name: true } },
          supplierProducts: {
            include: { supplier: { select: { id: true, name: true } } },
          },
          marketplaceListings: true,
          images: { orderBy: { position: "asc" } },
          _count: { select: { orderItems: true } },
        },
      }),
    ]);

    let formattedProducts = products.map((p) => {
      const cost = Number(p.costPrice);
      const selling = Number(p.sellingPrice);
      const metrics = calculatePricingMetrics(cost, selling);

      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        description: p.description,
        shortDescription: p.shortDescription,
        category: p.category,
        supplier: p.supplier,
        brand: p.brand,
        tags: p.tags,
        minPrice: p.minPrice ? Number(p.minPrice) : null,
        maxPrice: p.maxPrice ? Number(p.maxPrice) : null,
        targetMargin: p.targetMargin ? Number(p.targetMargin) : null,
        targetMarkup: p.targetMarkup ? Number(p.targetMarkup) : null,
        costPrice: cost,
        sellingPrice: selling,
        stock: p.stock,
        status: p.status,
        active: p.active,
        supplierUrl: p.supplierUrl,
        externalId: p.externalId,
        images: p.images,
        supplierProducts: p.supplierProducts.map((sp) => ({
          id: sp.id,
          supplierId: sp.supplierId,
          supplierName: sp.supplier.name,
          externalSku: sp.externalSku,
          supplierCost: Number(sp.supplierCost),
          supplierStock: sp.supplierStock,
          isAvailable: sp.isAvailable,
          lastSyncedAt: sp.lastSyncedAt,
          lastSyncError: sp.lastSyncError,
          supplierUrl: sp.supplierUrl,
        })),
        marketplaceListings: p.marketplaceListings.map((ml) => ({
          id: ml.id,
          channel: ml.channel,
          externalListingId: ml.externalListingId,
          status: ml.status,
          marketplacePrice: ml.marketplacePrice ? Number(ml.marketplacePrice) : null,
          marketplaceStock: ml.marketplaceStock,
          lastSyncedAt: ml.lastSyncedAt,
          syncError: ml.syncError,
        })),
        salesCount: p._count.orderItems,
        profit: metrics.profit,
        marginPercentage: metrics.marginPercentage,
        markupPercentage: metrics.markupPercentage,
        markupMultiplier: metrics.markupMultiplier,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      };
    });

    // Filtro adicional de margem em memória caso solicitado
    if (minMargin !== undefined && !isNaN(minMargin)) {
      formattedProducts = formattedProducts.filter((p) => p.marginPercentage >= minMargin);
    }
    if (maxMargin !== undefined && !isNaN(maxMargin)) {
      formattedProducts = formattedProducts.filter((p) => p.marginPercentage <= maxMargin);
    }

    return NextResponse.json({
      success: true,
      data: formattedProducts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_PRODUCTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar produtos." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await requireAuth();

    const body = await req.json();
    const parseResult = ProductSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do produto inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      name,
      slug,
      sku,
      description,
      shortDescription,
      categoryId,
      supplierId,
      costPrice,
      sellingPrice,
      stock,
      status,
      active,
      brand,
      tags,
      minPrice,
      maxPrice,
      targetMargin,
      targetMarkup,
      supplierUrl,
      externalId,
      images,
    } = parseResult.data;

    // Verificar unicidade de SKU e Slug
    const [existingSlug, existingSku] = await Promise.all([
      prisma.product.findUnique({ where: { slug } }),
      prisma.product.findUnique({ where: { sku } }),
    ]);

    if (existingSlug) {
      return NextResponse.json(
        { error: "Já existe um produto cadastrado com este slug." },
        { status: 409 }
      );
    }

    if (existingSku) {
      return NextResponse.json(
        { error: "Já existe um produto cadastrado com este SKU." },
        { status: 409 }
      );
    }

    // Criar o produto no PostgreSQL com valores Decimal, SupplierProduct inicial e evento na Outbox
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name,
          slug,
          sku,
          description,
          shortDescription: shortDescription || null,
          categoryId: categoryId || null,
          supplierId: supplierId || null,
          costPrice: new Decimal(costPrice),
          sellingPrice: new Decimal(sellingPrice),
          stock: stock ?? 0,
          status: status as ProductStatus,
          active: active ?? true,
          brand: brand || null,
          tags: tags || [],
          minPrice: minPrice ? new Decimal(minPrice) : null,
          maxPrice: maxPrice ? new Decimal(maxPrice) : null,
          targetMargin: targetMargin ? new Decimal(targetMargin) : null,
          targetMarkup: targetMarkup ? new Decimal(targetMarkup) : null,
          supplierUrl: supplierUrl || null,
          externalId: externalId || null,
          images: images && images.length > 0
            ? {
                create: images.map((img, idx) => ({
                  url: img.url,
                  altText: img.altText || name,
                  isCover: img.isCover ?? (idx === 0),
                  position: idx,
                })),
              }
            : undefined,
        },
        include: {
          images: true,
          category: true,
          supplier: true,
        },
      });

      // Se fornecedor foi associado, cria o registro inicial em SupplierProduct
      if (supplierId) {
        await tx.supplierProduct.create({
          data: {
            productId: created.id,
            supplierId,
            supplierCost: new Decimal(costPrice),
            supplierStock: stock ?? 0,
            externalSku: externalId || sku,
            supplierUrl: supplierUrl || null,
            isAvailable: (stock ?? 0) > 0,
            lastSyncedAt: new Date(),
          },
        });
      }

      // Registro de auditoria inicial
      await tx.productAuditLog.create({
        data: {
          productId: created.id,
          field: "STATUS",
          oldValue: null,
          newValue: created.status,
          changedByUserId: authUser.id || null,
          reason: "Criação de produto no catálogo",
        },
      });

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.PRODUCT_CREATED,
        entityType: "Product",
        entityId: created.id,
        data: {
          productId: created.id,
          sku: created.sku,
          slug: created.slug,
          name: created.name,
          costPrice: Number(created.costPrice),
          sellingPrice: Number(created.sellingPrice),
          stock: created.stock,
          status: created.status,
          active: created.active,
        },
      });

      return created;
    });

    return NextResponse.json({ success: true, product }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_PRODUCTS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar produto." }, { status: 500 });
  }
}

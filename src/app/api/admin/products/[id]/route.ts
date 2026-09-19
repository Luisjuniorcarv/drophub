import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { ProductSchema } from "@/lib/validators";
import { Decimal } from "@prisma/client/runtime/library";
import { calculatePricingMetrics } from "@/lib/finance-math";
import { ProductStatus } from "@prisma/client";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: true,
        supplier: true,
        supplierProducts: {
          include: {
            supplier: { select: { id: true, name: true, contactName: true, email: true, phone: true } },
          },
        },
        marketplaceListings: true,
        images: { orderBy: { position: "asc" } },
        variants: true,
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
        _count: { select: { orderItems: true, stockMovements: true } },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    const cost = Number(product.costPrice);
    const selling = Number(product.sellingPrice);
    const metrics = calculatePricingMetrics(cost, selling);

    return NextResponse.json({
      success: true,
      product: {
        ...product,
        costPrice: cost,
        sellingPrice: selling,
        minPrice: product.minPrice ? Number(product.minPrice) : null,
        maxPrice: product.maxPrice ? Number(product.maxPrice) : null,
        targetMargin: product.targetMargin ? Number(product.targetMargin) : null,
        targetMarkup: product.targetMarkup ? Number(product.targetMarkup) : null,
        salesCount: product._count.orderItems,
        stockMovementsCount: product._count.stockMovements,
        profit: metrics.profit,
        marginPercentage: metrics.marginPercentage,
        markupPercentage: metrics.markupPercentage,
        markupMultiplier: metrics.markupMultiplier,
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_PRODUCT_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar produto." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    const authUser = await requireAuth();
    const { id } = await params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

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

    // Verificar unicidade se SKU ou Slug mudaram
    if (slug !== existing.slug) {
      const slugInUse = await prisma.product.findUnique({ where: { slug } });
      if (slugInUse && slugInUse.id !== id) {
        return NextResponse.json(
          { error: "Já existe outro produto cadastrado com este slug." },
          { status: 409 }
        );
      }
    }

    if (sku !== existing.sku) {
      const skuInUse = await prisma.product.findUnique({ where: { sku } });
      if (skuInUse && skuInUse.id !== id) {
        return NextResponse.json(
          { error: "Já existe outro produto cadastrado com este SKU." },
          { status: 409 }
        );
      }
    }

    // Atualização com transação para atualizar dados, imagens e registrar logs de auditoria
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Imagens
      if (images) {
        await tx.productImage.deleteMany({ where: { productId: id } });
        if (images.length > 0) {
          await tx.productImage.createMany({
            data: images.map((img, idx) => ({
              productId: id,
              url: img.url,
              altText: img.altText || name,
              isCover: img.isCover ?? (idx === 0),
              position: idx,
            })),
          });
        }
      }

      // 2. Registro de Auditoria de Diffs
      const changes: Array<{ field: string; oldValue: string | null; newValue: string | null }> = [];

      if (Number(existing.sellingPrice) !== sellingPrice) {
        changes.push({
          field: "SELLING_PRICE",
          oldValue: String(existing.sellingPrice),
          newValue: String(sellingPrice),
        });
      }
      if (Number(existing.costPrice) !== costPrice) {
        changes.push({
          field: "COST_PRICE",
          oldValue: String(existing.costPrice),
          newValue: String(costPrice),
        });
      }
      if (existing.status !== status) {
        changes.push({
          field: "STATUS",
          oldValue: existing.status,
          newValue: status,
        });
      }
      if (existing.supplierId !== (supplierId || null)) {
        changes.push({
          field: "SUPPLIER",
          oldValue: existing.supplierId,
          newValue: supplierId || null,
        });
      }
      if (existing.stock !== (stock ?? 0)) {
        changes.push({
          field: "STOCK",
          oldValue: String(existing.stock),
          newValue: String(stock ?? 0),
        });
      }

      for (const change of changes) {
        await tx.productAuditLog.create({
          data: {
            productId: id,
            field: change.field,
            oldValue: change.oldValue,
            newValue: change.newValue,
            changedByUserId: authUser.id || null,
            reason: body.auditReason || "Edição administrativa de produto",
          },
        });
      }

      // 3. Atualizar Produto
      const productUpdated = await tx.product.update({
        where: { id },
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
        },
        include: {
          images: { orderBy: { position: "asc" } },
          category: true,
          supplier: true,
          supplierProducts: true,
          marketplaceListings: true,
        },
      });

      // 4. Se fornecedor foi selecionado, garante vínculo em SupplierProduct
      if (supplierId) {
        await tx.supplierProduct.upsert({
          where: {
            productId_supplierId: {
              productId: id,
              supplierId,
            },
          },
          update: {
            supplierCost: new Decimal(costPrice),
            supplierStock: stock ?? 0,
            externalSku: externalId || sku,
            supplierUrl: supplierUrl || null,
            isAvailable: (stock ?? 0) > 0,
          },
          create: {
            productId: id,
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

      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.PRODUCT_UPDATED,
        entityType: "Product",
        entityId: productUpdated.id,
        data: {
          productId: productUpdated.id,
          sku: productUpdated.sku,
          slug: productUpdated.slug,
          name: productUpdated.name,
          costPrice: Number(productUpdated.costPrice),
          sellingPrice: Number(productUpdated.sellingPrice),
          stock: productUpdated.stock,
          status: productUpdated.status,
          active: productUpdated.active,
        },
      });

      return productUpdated;
    });

    return NextResponse.json({ success: true, product: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_PRODUCT_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar produto." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        _count: {
          select: { orderItems: true },
        },
      },
    });

    if (!product) {
      return NextResponse.json({ error: "Produto não encontrado." }, { status: 404 });
    }

    if (product._count.orderItems > 0) {
      return NextResponse.json(
        {
          error: `Não é possível excluir este produto pois ele já possui ${product._count.orderItems} venda(s) registrada(s) no histórico de pedidos. Recomendamos desativar ou arquivar o produto.`,
        },
        { status: 400 }
      );
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({
      success: true,
      message: "Produto excluído com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_PRODUCT_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir produto." }, { status: 500 });
  }
}

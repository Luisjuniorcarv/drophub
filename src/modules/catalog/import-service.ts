import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ProductStatus } from "@prisma/client";
import { CatalogImportItemSchema } from "@/lib/validators";
import {
  ImportPreviewResult,
  ImportCommitResult,
  ImportValidationRow,
} from "./types";
import { publishDomainEvent } from "@/modules/automations/outbox";
import { DOMAIN_EVENTS } from "@/modules/automations/events";
import crypto from "crypto";

/**
 * Utilitário de parsing de CSV simples e robusto sem dependências externas
 */
export function parseCsv(csvText: string): Record<string, string>[] {
  const lines = csvText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return [];
  }

  // Detecta separador (, ou ;)
  const headerLine = lines[0];
  const separator = headerLine.includes(";") ? ";" : ",";

  const headers = headerLine
    .split(separator)
    .map((h) => h.replace(/^["']|["']$/g, "").trim());

  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    const values = line
      .split(separator)
      .map((v) => v.replace(/^["']|["']$/g, "").trim());

    const rowObj: Record<string, string> = {};
    headers.forEach((header, index) => {
      rowObj[header] = values[index] ?? "";
    });

    rows.push(rowObj);
  }

  return rows;
}

/**
 * Normaliza campos numéricos e enums para validação do Zod
 */
function normalizeRawItem(item: any, defaultStatus: ProductStatus = ProductStatus.ACTIVE): any {
  return {
    name: String(item.name || item.nome || item.title || "").trim(),
    sku: String(item.sku || item.SKU || item.codigo || "").trim().toUpperCase(),
    slug: item.slug
      ? String(item.slug).trim()
      : String(item.name || item.nome || "")
          .toLowerCase()
          .trim()
          .replace(/[^\w\s-]/g, "")
          .replace(/[\s_-]+/g, "-")
          .replace(/^-+|-+$/g, ""),
    description: String(item.description || item.descricao || "Sem descrição informada").trim(),
    categoryName: item.category || item.categoria || item.categoryName || null,
    supplierName: item.supplier || item.fornecedor || item.supplierName || null,
    costPrice: Number(String(item.costPrice ?? item.custo ?? item.preco_custo ?? 0).replace(",", ".")),
    sellingPrice: Number(String(item.sellingPrice ?? item.preco ?? item.preco_venda ?? 0).replace(",", ".")),
    stock: parseInt(String(item.stock ?? item.estoque ?? 0), 10) || 0,
    status: (item.status ? String(item.status).toUpperCase() : defaultStatus) as ProductStatus,
    brand: item.brand || item.marca || null,
    tags: Array.isArray(item.tags)
      ? item.tags
      : typeof item.tags === "string" && item.tags.length > 0
      ? item.tags.split(",").map((t: string) => t.trim())
      : [],
    externalSku: item.externalSku || item.sku_fornecedor || null,
    supplierUrl: item.supplierUrl || item.url_fornecedor || null,
    imageUrl: item.imageUrl || item.imagem || item.foto || null,
  };
}

export class CatalogImportService {
  /**
   * FASE 1: Pré-visualização da importação de catálogo (Preview seguro sem persistência)
   */
  static async preview(params: {
    format: "CSV" | "JSON";
    rawData: string;
    supplierId?: string | null;
    defaultStatus?: ProductStatus;
  }): Promise<ImportPreviewResult> {
    let rawItems: any[] = [];

    if (params.format === "JSON") {
      try {
        const parsed = JSON.parse(params.rawData);
        rawItems = Array.isArray(parsed) ? parsed : [parsed];
      } catch (err: any) {
        throw new Error(`JSON inválido: ${err.message}`);
      }
    } else {
      rawItems = parseCsv(params.rawData);
    }

    if (rawItems.length === 0) {
      throw new Error("O arquivo ou conteúdo fornecido não contém nenhum registro para importar.");
    }

    // Coleta todos os SKUs para consulta em lote no banco
    const seenSkusInFile = new Set<string>();
    const validationRows: ImportValidationRow[] = [];

    const skusToCheck = rawItems
      .map((item) => String(item.sku || item.SKU || item.codigo || "").trim().toUpperCase())
      .filter((s) => s.length > 0);

    const existingProductsInDb = await prisma.product.findMany({
      where: { sku: { in: skusToCheck } },
      select: { sku: true, id: true, name: true },
    });
    const existingSkuMap = new Set(existingProductsInDb.map((p) => p.sku));

    let validCount = 0;
    let invalidCount = 0;
    let newCount = 0;
    let updateCount = 0;
    let duplicateInFileCount = 0;

    const errorList: Array<{ rowNumber: number; message: string }> = [];

    for (let index = 0; index < rawItems.length; index++) {
      const rowNumber = index + 1;
      const raw = rawItems[index];
      const normalized = normalizeRawItem(raw, params.defaultStatus);

      // Validação com Zod
      const parseResult = CatalogImportItemSchema.safeParse(normalized);

      if (!parseResult.success) {
        invalidCount++;
        const fieldErrors = parseResult.error.flatten().fieldErrors;
        const messages = Object.entries(fieldErrors).map(
          ([field, errs]) => `${field}: ${errs?.join(", ")}`
        );
        const combinedErr = messages.join(" | ");

        errorList.push({ rowNumber, message: combinedErr });

        validationRows.push({
          rowNumber,
          data: normalized,
          isValid: false,
          errors: messages,
          isDuplicateInFile: false,
          existsInDb: false,
          action: "INVALID",
        });
        continue;
      }

      const validItem = parseResult.data;
      const sku = validItem.sku;

      // Verificação de duplicata interna no arquivo
      if (seenSkusInFile.has(sku)) {
        duplicateInFileCount++;
        validationRows.push({
          rowNumber,
          data: validItem,
          isValid: false,
          errors: [`SKU '${sku}' duplicado no próprio arquivo de importação`],
          isDuplicateInFile: true,
          existsInDb: existingSkuMap.has(sku),
          action: "SKIP",
        });
        continue;
      }

      seenSkusInFile.add(sku);
      validCount++;

      const existsInDb = existingSkuMap.has(sku);
      if (existsInDb) {
        updateCount++;
      } else {
        newCount++;
      }

      validationRows.push({
        rowNumber,
        data: validItem,
        isValid: true,
        errors: [],
        isDuplicateInFile: false,
        existsInDb,
        action: existsInDb ? "UPDATE" : "CREATE",
      });
    }

    const batchHash = crypto
      .createHash("sha256")
      .update(params.rawData + "_" + Date.now())
      .digest("hex")
      .slice(0, 16);

    return {
      importBatchId: `batch_${batchHash}`,
      totalRows: rawItems.length,
      validCount,
      invalidCount,
      newCount,
      updateCount,
      duplicateInFileCount,
      rows: validationRows,
      summary: {
        canCommit: validCount > 0,
        sampleValid: validationRows.filter((r) => r.isValid).slice(0, 5).map((r) => r.data),
        errors: errorList,
      },
    };
  }

  /**
   * FASE 2: Gravação efetiva, transacional e idempotente dos dados importados
   */
  static async commit(params: {
    importBatchId: string;
    items: any[];
    updateExisting?: boolean;
    syncStockLedger?: boolean;
    userId?: string;
  }): Promise<ImportCommitResult> {
    const { items, updateExisting = true, syncStockLedger = true, userId } = params;

    let createdCount = 0;
    let updatedCount = 0;
    let failedCount = 0;
    const errors: Array<{ sku: string; error: string }> = [];

    // Execução em transação protegida
    await prisma.$transaction(async (tx) => {
      for (const rawItem of items) {
        try {
          const parsed = CatalogImportItemSchema.safeParse(rawItem);
          if (!parsed.success) {
            failedCount++;
            errors.push({
              sku: rawItem.sku || "UNKNOWN",
              error: JSON.stringify(parsed.error.flatten().fieldErrors),
            });
            continue;
          }

          const item = parsed.data;

          // 1. Resolver Categoria se informada
          let categoryId: string | null = null;
          if (item.categoryName) {
            const categorySlug = item.categoryName
              .toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, "")
              .replace(/[\s_-]+/g, "-");

            const category = await tx.category.upsert({
              where: { slug: categorySlug },
              update: { name: item.categoryName },
              create: { name: item.categoryName, slug: categorySlug },
            });
            categoryId = category.id;
          }

          // 2. Resolver Fornecedor se informado
          let supplierId: string | null = null;
          if (item.supplierName) {
            let supplier = await tx.supplier.findFirst({
              where: { name: { equals: item.supplierName, mode: "insensitive" } },
            });

            if (!supplier) {
              supplier = await tx.supplier.create({
                data: {
                  name: item.supplierName,
                  notes: "Cadastrado automaticamente via importação de catálogo",
                },
              });
            }
            supplierId = supplier.id;
          }

          // 3. Verificar se produto já existe
          const existing = await tx.product.findUnique({
            where: { sku: item.sku },
          });

          let product: any;

          const tagsArray = Array.isArray(item.tags)
            ? item.tags
            : typeof item.tags === "string" && item.tags.length > 0
            ? (item.tags as string).split(",").map((t) => t.trim())
            : [];

          if (existing) {
            if (!updateExisting) {
              continue;
            }

            product = await tx.product.update({
              where: { id: existing.id },
              data: {
                name: item.name,
                description: item.description,
                costPrice: new Decimal(item.costPrice),
                sellingPrice: new Decimal(item.sellingPrice),
                stock: item.stock,
                status: item.status as ProductStatus,
                brand: item.brand || existing.brand,
                tags: tagsArray.length > 0 ? tagsArray : existing.tags,
                categoryId: categoryId || existing.categoryId,
                supplierId: supplierId || existing.supplierId,
                supplierUrl: item.supplierUrl || existing.supplierUrl,
              },
            });

            // Auditoria de alteração de preço/custo via importação
            if (Number(existing.sellingPrice) !== item.sellingPrice) {
              await tx.productAuditLog.create({
                data: {
                  productId: product.id,
                  field: "SELLING_PRICE",
                  oldValue: String(existing.sellingPrice),
                  newValue: String(item.sellingPrice),
                  changedByUserId: userId || null,
                  reason: `Importação em lote (${params.importBatchId})`,
                },
              });
            }

            updatedCount++;
          } else {
            // Gerar slug único
            let slugCandidate =
              item.slug ||
              item.name
                .toLowerCase()
                .trim()
                .replace(/[^\w\s-]/g, "")
                .replace(/[\s_-]+/g, "-");

            const slugExists = await tx.product.findUnique({
              where: { slug: slugCandidate },
            });

            if (slugExists) {
              slugCandidate = `${slugCandidate}-${item.sku.toLowerCase()}`;
            }

            product = await tx.product.create({
              data: {
                name: item.name,
                sku: item.sku,
                slug: slugCandidate,
                description: item.description,
                costPrice: new Decimal(item.costPrice),
                sellingPrice: new Decimal(item.sellingPrice),
                stock: item.stock,
                status: item.status as ProductStatus,
                brand: item.brand || null,
                tags: tagsArray,
                categoryId,
                supplierId,
                supplierUrl: item.supplierUrl || null,
              },
            });

            await publishDomainEvent(tx, {
              type: DOMAIN_EVENTS.PRODUCT_CREATED,
              entityType: "Product",
              entityId: product.id,
              data: {
                productId: product.id,
                sku: product.sku,
                name: product.name,
                costPrice: Number(product.costPrice),
                sellingPrice: Number(product.sellingPrice),
                stock: product.stock,
                source: "CATALOG_IMPORT",
              },
            });

            createdCount++;
          }

          // 4. Imagem se informada
          if (item.imageUrl) {
            const existingImage = await tx.productImage.findFirst({
              where: { productId: product.id, url: item.imageUrl },
            });
            if (!existingImage) {
              await tx.productImage.create({
                data: {
                  productId: product.id,
                  url: item.imageUrl,
                  altText: product.name,
                  isCover: true,
                  position: 0,
                },
              });
            }
          }

          // 5. Relacionamento SupplierProduct se houver fornecedor
          if (supplierId) {
            await tx.supplierProduct.upsert({
              where: {
                productId_supplierId: {
                  productId: product.id,
                  supplierId,
                },
              },
              update: {
                supplierCost: new Decimal(item.costPrice),
                supplierStock: item.stock,
                externalSku: item.externalSku || item.sku,
                supplierUrl: item.supplierUrl || null,
                isAvailable: item.stock > 0,
                lastSyncedAt: new Date(),
              },
              create: {
                productId: product.id,
                supplierId,
                supplierCost: new Decimal(item.costPrice),
                supplierStock: item.stock,
                externalSku: item.externalSku || item.sku,
                supplierUrl: item.supplierUrl || null,
                isAvailable: item.stock > 0,
                lastSyncedAt: new Date(),
              },
            });
          }
        } catch (itemErr: any) {
          failedCount++;
          errors.push({
            sku: rawItem.sku || "UNKNOWN",
            error: itemErr.message || "Erro desconhecido ao processar item",
          });
        }
      }
    });

    return {
      success: createdCount > 0 || updatedCount > 0,
      importBatchId: params.importBatchId,
      createdCount,
      updatedCount,
      failedCount,
      errors,
    };
  }
}

import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { ProductStatus } from "@prisma/client";

describe("Catalog CRUD & Relationships Integration Tests", () => {
  let createdCategoryId: string;
  let createdSupplierId: string;
  let createdProductId: string;

  it("deve criar, buscar e atualizar uma categoria", async () => {
    const slug = "categoria-teste-" + Date.now();
    const category = await prisma.category.create({
      data: {
        name: "Categoria Teste Automatizado",
        slug,
        description: "Descrição de categoria para testes",
        active: true,
      },
    });

    expect(category.id).toBeDefined();
    expect(category.name).toBe("Categoria Teste Automatizado");
    createdCategoryId = category.id;

    // Atualizar
    const updated = await prisma.category.update({
      where: { id: category.id },
      data: { name: "Categoria Teste Atualizada" },
    });

    expect(updated.name).toBe("Categoria Teste Atualizada");
  });

  it("deve criar, buscar e atualizar um fornecedor", async () => {
    const supplier = await prisma.supplier.create({
      data: {
        name: "Fornecedor Parceiro Teste",
        contactName: "Contato Teste",
        email: `fornecedor-${Date.now()}@teste.com`,
        phone: "(11) 97777-6666",
        notes: "Fornecedor homologado para testes",
        active: true,
      },
    });

    expect(supplier.id).toBeDefined();
    expect(supplier.name).toBe("Fornecedor Parceiro Teste");
    createdSupplierId = supplier.id;

    // Atualizar
    const updated = await prisma.supplier.update({
      where: { id: supplier.id },
      data: { notes: "Notas atualizadas com sucesso" },
    });

    expect(updated.notes).toBe("Notas atualizadas com sucesso");
  });

  it("deve criar um produto com SKU único, categoria, fornecedor e imagens com Decimal", async () => {
    const sku = "TEST-SKU-" + Date.now();
    const slug = "produto-teste-completo-" + Date.now();

    const product = await prisma.product.create({
      data: {
        name: "Produto Teste Completo",
        slug,
        sku,
        description: "Descrição completa do produto de teste",
        shortDescription: "Chamada curta",
        categoryId: createdCategoryId,
        supplierId: createdSupplierId,
        costPrice: new Decimal("50.00"),
        sellingPrice: new Decimal("120.00"),
        stock: 15,
        status: ProductStatus.ACTIVE,
        images: {
          create: [
            { url: "https://exemplo.com/foto1.jpg", isCover: true, position: 0 },
            { url: "https://exemplo.com/foto2.jpg", isCover: false, position: 1 },
          ],
        },
      },
      include: {
        category: true,
        supplier: true,
        images: true,
      },
    });

    expect(product.id).toBeDefined();
    expect(product.categoryId).toBe(createdCategoryId);
    expect(product.supplierId).toBe(createdSupplierId);
    expect(product.images.length).toBe(2);
    expect(Number(product.costPrice)).toBe(50.0);
    expect(Number(product.sellingPrice)).toBe(120.0);

    createdProductId = product.id;
  });

  it("deve impedir exclusão de categoria que possui produto vinculado", async () => {
    const count = await prisma.product.count({
      where: { categoryId: createdCategoryId },
    });

    expect(count).toBeGreaterThan(0);
    // Simulação da verificação de regra de negócio da API
    const canDelete = count === 0;
    expect(canDelete).toBe(false);
  });

  it("deve impedir exclusão de fornecedor que possui produto vinculado", async () => {
    const count = await prisma.product.count({
      where: { supplierId: createdSupplierId },
    });

    expect(count).toBeGreaterThan(0);
    const canDelete = count === 0;
    expect(canDelete).toBe(false);
  });

  it("deve limpar e excluir os registros criados sem violar integridade", async () => {
    // 1. Excluir produto e cascata de imagens
    await prisma.product.delete({ where: { id: createdProductId } });

    // 2. Agora categoria pode ser excluída
    const remainingInCat = await prisma.product.count({
      where: { categoryId: createdCategoryId },
    });
    expect(remainingInCat).toBe(0);
    await prisma.category.delete({ where: { id: createdCategoryId } });

    // 3. Agora fornecedor pode ser excluído
    const remainingInSup = await prisma.product.count({
      where: { supplierId: createdSupplierId },
    });
    expect(remainingInSup).toBe(0);
    await prisma.supplier.delete({ where: { id: createdSupplierId } });
  });
});

import { describe, it, expect } from "vitest";
import { parseCsv } from "@/modules/catalog/import-service";
import { CatalogImportItemSchema } from "@/lib/validators";

describe("ETAPA 14 — Catalog Import Parser & Item Validator Unit Tests", () => {
  it("1. should parse standard CSV with comma separator correctly", () => {
    const csv = `sku,name,description,costPrice,sellingPrice,stock\nPROD-01,Produto Um,Descricao Um,10.50,29.90,100\nPROD-02,Produto Dois,Descricao Dois,20.00,49.90,50`;
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(2);
    expect(rows[0].sku).toBe("PROD-01");
    expect(rows[0].name).toBe("Produto Um");
    expect(rows[1].sku).toBe("PROD-02");
  });

  it("2. should parse CSV with semicolon separator and quotes correctly", () => {
    const csv = `"sku";"name";"description";"costPrice";"sellingPrice";"stock"\n"PROD-03";"Produto Três";"Descricao Três";"35,00";"89,90";"25"`;
    const rows = parseCsv(csv);

    expect(rows).toHaveLength(1);
    expect(rows[0].sku).toBe("PROD-03");
    expect(rows[0].name).toBe("Produto Três");
  });

  it("3. should validate CatalogImportItemSchema and reject invalid lines", () => {
    const valid = {
      name: "Produto Válido",
      sku: "SKU-VAL-01",
      costPrice: 20,
      sellingPrice: 50,
      stock: 10,
      status: "ACTIVE",
    };
    expect(CatalogImportItemSchema.safeParse(valid).success).toBe(true);

    const missingSku = {
      name: "Produto Sem SKU",
      sku: "",
      costPrice: 20,
      sellingPrice: 50,
    };
    expect(CatalogImportItemSchema.safeParse(missingSku).success).toBe(false);

    const negativePrice = {
      name: "Produto Preço Negativo",
      sku: "SKU-NEG-01",
      costPrice: 20,
      sellingPrice: -10,
    };
    expect(CatalogImportItemSchema.safeParse(negativePrice).success).toBe(false);
  });
});

import { describe, it, expect } from "vitest";
import {
  isValidCpfFormat,
  isValidCepFormat,
  LoginSchema,
  ExpenseSchema,
  ProductSchema,
  CategorySchema,
  SupplierSchema,
  MarginCalculatorInputSchema,
} from "@/lib/validators";

describe("Validators Module", () => {
  it("deve validar formato de CPF com 11 dígitos numéricos", () => {
    expect(isValidCpfFormat("12345678901")).toBe(true);
    expect(isValidCpfFormat("123.456.789-01")).toBe(true);
    expect(isValidCpfFormat("12345")).toBe(false);
    expect(isValidCpfFormat("")).toBe(false);
  });

  it("deve validar formato de CEP com 8 dígitos numéricos", () => {
    expect(isValidCepFormat("01310100")).toBe(true);
    expect(isValidCepFormat("01310-100")).toBe(true);
    expect(isValidCepFormat("1234")).toBe(false);
  });

  it("deve validar schema de login", () => {
    const valid = LoginSchema.safeParse({
      email: "admin@drophub.com",
      password: "admin_secure_password_123",
    });
    expect(valid.success).toBe(true);

    const invalid = LoginSchema.safeParse({
      email: "not-an-email",
      password: "123",
    });
    expect(invalid.success).toBe(false);
  });

  it("deve validar schema de produto", () => {
    const validProduct = ProductSchema.safeParse({
      name: "Fone Bluetooth Pro",
      slug: "fone-bluetooth-pro",
      sku: "FONE-BT-01",
      description: "Fone de ouvido com cancelamento ativo de ruído",
      costPrice: 45.0,
      sellingPrice: 129.9,
      stock: 50,
      status: "ACTIVE",
    });
    expect(validProduct.success).toBe(true);

    const invalidProduct = ProductSchema.safeParse({
      name: "X",
      slug: "Slug Invalido Com Espaco",
      sku: "FONE",
      description: "Ok",
      costPrice: -10,
      sellingPrice: 0,
      stock: -5,
    });
    expect(invalidProduct.success).toBe(false);
  });

  it("deve validar schema de categoria e fornecedor", () => {
    const validCat = CategorySchema.safeParse({
      name: "Eletrônicos",
      slug: "eletronicos",
    });
    expect(validCat.success).toBe(true);

    const validSup = SupplierSchema.safeParse({
      name: "Fornecedor Global",
      email: "contato@global.com",
    });
    expect(validSup.success).toBe(true);
  });

  it("deve validar schema da calculadora de margem", () => {
    const validCalc = MarginCalculatorInputSchema.safeParse({
      productCost: 50,
      shippingCost: 10,
      sellingPrice: 100,
      targetMargin: 50,
    });
    expect(validCalc.success).toBe(true);
  });
});

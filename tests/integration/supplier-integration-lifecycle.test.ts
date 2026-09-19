import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { NextRequest } from "next/server";
import { SupplierCredentialService } from "@/modules/suppliers/credential-service";
import { SupplierIntegrationManager } from "@/modules/suppliers/integration-manager";
import { setGlobalTestSupplierAdapter as setSupplierTestAdapter } from "@/modules/suppliers/factory";
import {
  setGlobalTestSupplierAdapter as setFulfillmentTestAdapter,
  getTestSupplierAdapter as getFulfillmentTestAdapter,
} from "@/modules/fulfillment/supplier-factory";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { IntegrationStatus, FulfillmentStatus, OrderStatus } from "@prisma/client";
import { GET as getSuppliersApi } from "@/app/api/admin/suppliers/route";
import {
  GET as getSupplierIntegrationApi,
  PUT as putSupplierIntegrationApi,
  DELETE as deleteSupplierIntegrationApi,
} from "@/app/api/admin/suppliers/[id]/integration/route";
import { POST as testIntegrationApi } from "@/app/api/admin/suppliers/[id]/integration/test/route";
import { POST as enableIntegrationApi } from "@/app/api/admin/suppliers/[id]/integration/enable/route";
import { POST as disableIntegrationApi } from "@/app/api/admin/suppliers/[id]/integration/disable/route";
import {
  orchestratePaidOrderFulfillment,
  syncFulfillmentStatusFromSupplier,
} from "@/modules/fulfillment/service";
import * as authService from "@/modules/auth/service";

describe("ETAPA 16 — Supplier Integration Lifecycle, Security & Concurrency Tests", () => {
  let supplier: any;
  let testAdapter: TestSupplierAdapter;

  beforeEach(async () => {
    // Reset global test adapter
    testAdapter = new TestSupplierAdapter({ delayMs: 0 });
    setSupplierTestAdapter(testAdapter);
    getFulfillmentTestAdapter().reset();

    // Mock autenticação de admin para testes de API
    vi.spyOn(authService, "requireAuth").mockResolvedValue({
      id: "admin-stage16-id",
      email: "admin@drophub.com",
      name: "Admin DropHub",
      role: "ADMIN" as any,
    });

    // Criar fornecedor limpo para teste
    supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor Integrado Teste ${Date.now()}`,
        contactName: "Gerente de Integração",
        email: `integracao-${Date.now()}@fornecedor.com`,
        phone: "(11) 98765-4321",
        website: "https://fornecedor-teste.com",
        active: true,
      },
    });
  });

  describe("1. Credential Storage, Masking & Lifecycle (SupplierCredentialService)", () => {
    it("should save encrypted credentials and never store raw secrets in the database", async () => {
      const saved = await SupplierCredentialService.saveCredentials({
        supplierId: supplier.id,
        provider: "TEST",
        credentials: {
          apiKey: "sk-live-super-secret-key-12345",
          apiSecret: "sec-ultra-confidential-99887",
        },
        configuration: {
          baseUrl: "https://api.fornecedorteste.com/v1",
          timeoutMs: 8000,
        },
      });

      expect(saved.supplierId).toBe(supplier.id);
      expect(saved.status).toBe(IntegrationStatus.CONFIGURED);
      expect(saved.isConfigured).toBe(true);
      expect(saved.maskedCredentials.apiKey).toBe("sk••••••••45");
      expect(saved.maskedCredentials.apiSecret).toBe("se••••••••87");

      // Verificar diretamente no banco que está criptografado
      const rawInDb = await prisma.supplierIntegration.findUnique({
        where: { supplierId: supplier.id },
      });

      expect(rawInDb).toBeDefined();
      expect(rawInDb!.encryptedCredentials).toBeDefined();
      expect(rawInDb!.encryptedCredentials).not.toContain("sk-live-super-secret-key-12345");
      expect(rawInDb!.encryptedCredentials).not.toContain("sec-ultra-confidential-99887");
      expect(rawInDb!.encryptedCredentials).toContain(":"); // Formato iv:authTag:ciphertext
    });

    it("should allow partial credential updates by merging without losing unedited secrets", async () => {
      // 1. Salvar credenciais iniciais
      await SupplierCredentialService.saveCredentials({
        supplierId: supplier.id,
        provider: "TEST",
        credentials: {
          apiKey: "original_api_key_1111",
          apiSecret: "original_secret_2222",
        },
      });

      // 2. Atualizar apenas o apiSecret
      await SupplierCredentialService.saveCredentials({
        supplierId: supplier.id,
        provider: "TEST",
        credentials: {
          apiSecret: "new_updated_secret_3333",
        },
      });

      // 3. Recuperar credenciais no backend e verificar merge
      const decrypted = await SupplierCredentialService.getDecryptedCredentials<{
        apiKey: string;
        apiSecret: string;
      }>(supplier.id);

      expect(decrypted.credentials).toBeDefined();
      expect(decrypted.credentials!.apiKey).toBe("original_api_key_1111");
      expect(decrypted.credentials!.apiSecret).toBe("new_updated_secret_3333");
    });

    it("should remove credentials securely and reset status to NOT_CONFIGURED", async () => {
      await SupplierCredentialService.saveCredentials({
        supplierId: supplier.id,
        provider: "TEST",
        credentials: { apiKey: "to_be_deleted" },
      });

      await SupplierCredentialService.removeCredentials(supplier.id);

      const integration = await SupplierCredentialService.getMaskedIntegration(supplier.id);
      expect(integration).toBeDefined();
      expect(integration!.status).toBe(IntegrationStatus.NOT_CONFIGURED);
      expect(integration!.isConfigured).toBe(false);
      expect(Object.keys(integration!.maskedCredentials).length).toBe(0);

      const rawInDb = await prisma.supplierIntegration.findUnique({
        where: { supplierId: supplier.id },
      });
      expect(rawInDb!.encryptedCredentials).toBeNull();
    });
  });

  describe("2. Supplier Integration Manager & Connection Testing", () => {
    it("should test connection successfully and transition integration status to ACTIVE", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "valid_live_api_key_123" },
      });

      const testResult = await SupplierIntegrationManager.testConnection(supplier.id);

      expect(testResult.success).toBe(true);
      expect(testResult.status).toBe("CONNECTED");
      expect(testResult.message).toContain("sucesso");

      const integration = await SupplierIntegrationManager.getIntegration(supplier.id);
      expect(integration!.status).toBe(IntegrationStatus.ACTIVE);
      expect(integration!.lastTestedAt).toBeDefined();
      expect(integration!.lastError).toBeNull();
    });

    it("should handle test connection failure gracefully without exposing sensitive error payloads", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "invalid_key", invalid: true },
      });

      const testResult = await SupplierIntegrationManager.testConnection(supplier.id);

      expect(testResult.success).toBe(false);
      expect(testResult.status).toBe("FAILED");
      expect(testResult.category).toBe("INVALID_CREDENTIALS");
      expect(testResult.errorMessage).toContain("401 Unauthorized");

      const integration = await SupplierIntegrationManager.getIntegration(supplier.id);
      expect(integration!.status).toBe(IntegrationStatus.ERROR);
      expect(integration!.lastTestedAt).toBeDefined();
      expect(integration!.lastError).toContain("401 Unauthorized");
    });

    it("should support enable and disable integration actions", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "my_key" },
        status: IntegrationStatus.ACTIVE,
      });

      // Desativar
      const disabled = await SupplierIntegrationManager.disableIntegration(supplier.id);
      expect(disabled.status).toBe(IntegrationStatus.DISABLED);

      // Tentar testar desativada -> rejeita
      const testWhileDisabled = await SupplierIntegrationManager.testConnection(supplier.id);
      expect(testWhileDisabled.success).toBe(false);
      expect(testWhileDisabled.errorMessage).toContain("desativada");

      // Reativar
      const enabled = await SupplierIntegrationManager.enableIntegration(supplier.id);
      expect(enabled.status).toBe(IntegrationStatus.ACTIVE);
    });
  });

  describe("3. Admin API Endpoints & Security Validation", () => {
    it("should return supplier list with integration summaries via GET /api/admin/suppliers", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "test_key" },
        status: IntegrationStatus.ACTIVE,
      });

      const req = new NextRequest("http://localhost:3000/api/admin/suppliers");
      const res = await getSuppliersApi(req);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);

      const found = data.suppliers.find((s: any) => s.id === supplier.id);
      expect(found).toBeDefined();
      expect(found.integration).toBeDefined();
      expect(found.integration.provider).toBe("TEST");
      expect(found.integration.status).toBe("ACTIVE");
      // Nunca deve retornar chaves brutas
      expect(found.integration.credentials).toBeUndefined();
    });

    it("should get masked integration via GET /api/admin/suppliers/:id/integration", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "secret_12345678" },
      });

      const req = new NextRequest(`http://localhost:3000/api/admin/suppliers/${supplier.id}/integration`);
      const res = await getSupplierIntegrationApi(req, {
        params: Promise.resolve({ id: supplier.id }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.integration.supplierId).toBe(supplier.id);
      expect(data.integration.maskedApiKey).toBe("se••••••••78");
      expect(data.integration.apiKey).toBeUndefined();
    });

    it("should save integration via PUT /api/admin/suppliers/:id/integration", async () => {
      const payload = {
        provider: "TEST",
        apiKey: "new_api_key_889977",
        baseUrl: "https://api.supplier.com",
        timeoutMs: 12000,
        retryMaxAttempts: 3,
        isActive: true,
      };

      const req = new NextRequest(
        `http://localhost:3000/api/admin/suppliers/${supplier.id}/integration`,
        {
          method: "PUT",
          body: JSON.stringify(payload),
        }
      );

      const res = await putSupplierIntegrationApi(req, {
        params: Promise.resolve({ id: supplier.id }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.integration.isConfigured).toBe(true);
      expect(data.integration.maskedApiKey).toBe("ne••••••••77");
      expect(data.integration.baseUrl).toBe("https://api.supplier.com");
    });

    it("should test connection via POST /api/admin/suppliers/:id/integration/test", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "good_key" },
      });

      const req = new NextRequest(
        `http://localhost:3000/api/admin/suppliers/${supplier.id}/integration/test`,
        { method: "POST" }
      );

      const res = await testIntegrationApi(req, {
        params: Promise.resolve({ id: supplier.id }),
      });

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.status).toBe("CONNECTED");
    });

    it("should block unauthenticated requests with HTTP 401 across all integration endpoints", async () => {
      vi.spyOn(authService, "requireAuth").mockRejectedValueOnce(new Error("UNAUTHORIZED"));

      const req = new NextRequest(`http://localhost:3000/api/admin/suppliers/${supplier.id}/integration`);
      const res = await getSupplierIntegrationApi(req, {
        params: Promise.resolve({ id: supplier.id }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("4. Concurrency & Database Consistency", () => {
    it("should handle simultaneous concurrent configuration updates safely without corruption", async () => {
      const updates = Array.from({ length: 5 }, (_, i) =>
        SupplierCredentialService.saveCredentials({
          supplierId: supplier.id,
          provider: "TEST",
          credentials: {
            apiKey: `concurrent_key_${i}`,
            iteration: i,
          },
          configuration: {
            timeoutMs: 5000 + i * 1000,
          },
        })
      );

      const results = await Promise.all(updates);
      expect(results).toHaveLength(5);

      // O banco deve permanecer consistente e recuperável
      const decrypted = await SupplierCredentialService.getDecryptedCredentials(supplier.id);
      expect(decrypted.credentials).toBeDefined();
      expect(decrypted.provider).toBe("TEST");
    });
  });

  describe("5. End-to-End Fulfillment Integration Non-Regression", () => {
    it("should execute complete dropshipping fulfillment pipeline with supplier integration", async () => {
      // 1. Criar produto associado ao fornecedor
      const category = await prisma.category.create({
        data: {
          name: `Categoria Stage 16 ${Date.now()}`,
          slug: `cat-stage16-${Date.now()}`,
        },
      });

      const product = await prisma.product.create({
        data: {
          name: "Produto Dropshipping Stage 16",
          slug: `prod-stage16-${Date.now()}`,
          sku: `SKU-STAGE16-${Date.now()}`,
          description: "Descrição de teste Stage 16",
          costPrice: 50.0,
          sellingPrice: 120.0,
          stock: 100,
          status: "ACTIVE",
          categoryId: category.id,
          supplierId: supplier.id,
        },
      });

      // 2. Configurar e ativar integração do fornecedor
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "integration_verified_key" },
        status: IntegrationStatus.ACTIVE,
      });

      // 3. Criar cliente e pedido pago
      const customer = await prisma.customer.create({
        data: {
          name: "Cliente Dropshipping 16",
          email: `cliente-${Date.now()}@teste.com`,
          cpf: `${Math.floor(10000000000 + Math.random() * 90000000000)}`,
          phone: "(11) 99999-8888",
        },
      });

      const order = await prisma.order.create({
        data: {
          orderNumber: `DH-16-${Date.now().toString().slice(-4)}`,
          customerId: customer.id,
          status: OrderStatus.PAID,
          subtotalAmount: 120.0,
          totalAmount: 120.0,
          totalCostAmount: 50.0,
          estimatedProfit: 70.0,
          marginPercentage: 58.33,
          markupPercentage: 140.0,
          shippingAddress: {
            street: "Rua do Fulfillment",
            number: "1600",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            postalCode: "01001-000",
          },
          items: {
            create: {
              productId: product.id,
              sku: product.sku,
              name: product.name,
              unitCost: 50.0,
              unitPrice: 120.0,
              quantity: 1,
              totalCost: 50.0,
              totalPrice: 120.0,
              profit: 70.0,
            },
          },
        },
      });

      // 4. Orquestrar fulfillment -> deve criar e submeter automaticamente
      const orchResult = await orchestratePaidOrderFulfillment(order.id);
      expect(orchResult.success).toBe(true);
      expect(orchResult.fulfillmentsCreated).toBe(1);
      expect(orchResult.fulfillmentsSubmitted).toBe(1);

      // 5. Verificar status da FulfillmentOrder no banco
      const fulfillment = await prisma.fulfillmentOrder.findFirst({
        where: { orderId: order.id },
      });

      expect(fulfillment).toBeDefined();
      expect(fulfillment!.status).toBe(FulfillmentStatus.ACKNOWLEDGED);
      expect(fulfillment!.externalOrderId).toBeDefined();
      expect(fulfillment!.supplierId).toBe(supplier.id);

      // 6. Sincronizar status do fornecedor até DELIVERED
      getFulfillmentTestAdapter().setSimulatedStatus(FulfillmentStatus.DELIVERED);
      getFulfillmentTestAdapter().setCustomTracking("BR160000001DH", "Correios SEDEX");

      const syncResult = await syncFulfillmentStatusFromSupplier(fulfillment!.id);
      expect(syncResult.success).toBe(true);
      expect(syncResult.status).toBe(FulfillmentStatus.DELIVERED);

      // 7. Verificar que o pedido pai avançou para DELIVERED
      const updatedOrder = await prisma.order.findUnique({
        where: { id: order.id },
      });
      expect(updatedOrder!.status).toBe(OrderStatus.DELIVERED);
    });
  });
});

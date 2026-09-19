import { describe, it, expect, beforeEach, vi } from "vitest";
import { prisma } from "@/lib/prisma";
import { SupplierCredentialService } from "@/modules/suppliers/credential-service";
import { SupplierIntegrationManager } from "@/modules/suppliers/integration-manager";
import { setGlobalTestSupplierAdapter } from "@/modules/suppliers/factory";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { IntegrationStatus } from "@prisma/client";

describe("ETAPA 17.1 — Multi-Provider Lifecycle & Guarded Execution Integration Tests", () => {
  let supplier: any;
  let testAdapter: TestSupplierAdapter;

  beforeEach(async () => {
    testAdapter = new TestSupplierAdapter({ delayMs: 0 });
    setGlobalTestSupplierAdapter(testAdapter);

    supplier = await prisma.supplier.create({
      data: {
        name: `Fornecedor Multi-Provider ${Date.now()}`,
        contactName: "Gerente Multi-Provider",
        email: `multiprov-${Date.now()}@fornecedor.com`,
        phone: "(11) 98765-4321",
        website: "https://fornecedor-multi.com",
        active: true,
      },
    });
  });

  describe("1. Provider Lifecycle & Activation Guards", () => {
    it("should prevent enabling an unconfigured integration", async () => {
      // Criação inicial sem credenciais -> NOT_CONFIGURED
      await prisma.supplierIntegration.create({
        data: {
          supplierId: supplier.id,
          provider: "GENERIC_REST",
          status: IntegrationStatus.NOT_CONFIGURED,
        },
      });

      await expect(
        SupplierIntegrationManager.enableIntegration(supplier.id)
      ).rejects.toThrow("CANNOT_ENABLE_UNCONFIGURED_INTEGRATION");
    });

    it("should prevent enabling when provider requires credentials but none were provided", async () => {
      await prisma.supplierIntegration.create({
        data: {
          supplierId: supplier.id,
          provider: "GENERIC_REST",
          status: IntegrationStatus.CONFIGURED,
          encryptedCredentials: null,
        },
      });

      await expect(
        SupplierIntegrationManager.enableIntegration(supplier.id)
      ).rejects.toThrow("CANNOT_ENABLE_WITHOUT_CREDENTIALS");
    });

    it("should allow configuring, testing and enabling when valid credentials and URL are present", async () => {
      // 1. Configurar
      const configured = await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "valid_live_key_99" },
        configuration: { baseUrl: "https://api.supplier.com" },
        status: IntegrationStatus.CONFIGURED,
      });

      expect(configured.status).toBe(IntegrationStatus.CONFIGURED);
      expect(configured.isConfigured).toBe(true);
      expect(configured.capabilities.length).toBeGreaterThan(0);

      // 2. Testar conexão
      const testRes = await SupplierIntegrationManager.testConnection(supplier.id);
      expect(testRes.success).toBe(true);
      expect(testRes.status).toBe("CONNECTED");
      expect(testRes.latencyMs).toBeDefined();

      // 3. Ativar
      const enabled = await SupplierIntegrationManager.enableIntegration(supplier.id);
      expect(enabled.status).toBe(IntegrationStatus.ACTIVE);
    });
  });

  describe("2. Guarded Operations Execution (Capability & Status Checks)", () => {
    it("should execute guarded operation successfully when supplier is ACTIVE and capability is supported", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "key_1" },
        status: IntegrationStatus.ACTIVE,
      });

      const res = await SupplierIntegrationManager.executeGuardedOperation(
        supplier.id,
        "ORDER_CREATE",
        async (adapter) => {
          return await adapter.createOrder({
            fulfillmentOrderId: "ful-123",
            orderNumber: "DH-123",
            supplierId: supplier.id,
            supplierName: supplier.name,
            recipient: { name: "Maria", street: "Rua A", city: "SP", state: "SP", postalCode: "01000-000" },
            items: [{ sku: "SKU-TEST-1", name: "Item 1", quantity: 2, unitCost: 15 }],
          });
        }
      );

      expect(res.success).toBe(true);
      expect(res.data?.status).toBe("ACKNOWLEDGED");
      expect(res.data?.externalOrderId).toBeDefined();
    });

    it("should block guarded operation if integration is DISABLED or NOT_CONFIGURED", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "key_1" },
        status: IntegrationStatus.DISABLED,
      });

      const res = await SupplierIntegrationManager.executeGuardedOperation(
        supplier.id,
        "ORDER_CREATE",
        async (adapter) => adapter.createOrder({} as any)
      );

      expect(res.success).toBe(false);
      expect(res.category).toBe("NOT_CONFIGURED");
      expect(res.errorMessage).toContain("desativada");
    });

    it("should block guarded operation if provider does not support the requested capability", async () => {
      // Restringir capabilities do mock
      testAdapter.setSupportedCapabilities(["PRODUCTS", "STOCK"]);

      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "TEST",
        credentials: { apiKey: "key_1" },
        status: IntegrationStatus.ACTIVE,
      });

      const res = await SupplierIntegrationManager.executeGuardedOperation(
        supplier.id,
        "ORDER_CANCEL",
        async (adapter) => adapter.cancelOrder({ externalOrderId: "EXT-1", reason: "Test" })
      );

      expect(res.success).toBe(false);
      expect(res.category).toBe("OPERATION_NOT_SUPPORTED");
      expect(res.errorMessage).toContain("ORDER_CANCEL");
    });
  });

  describe("3. Listing Integrations with Capabilities", () => {
    it("should include supported capabilities for each supplier in listIntegrations", async () => {
      await SupplierIntegrationManager.configureIntegration(supplier.id, {
        provider: "GENERIC_REST",
        credentials: { apiKey: "generic_key" },
        status: IntegrationStatus.ACTIVE,
      });

      const list = await SupplierIntegrationManager.listIntegrations();
      const item = list.find((i) => i.supplierId === supplier.id);

      expect(item).toBeDefined();
      expect(item!.capabilities).toBeDefined();
      expect(item!.capabilities).toContain("PRODUCTS");
      expect(item!.capabilities).toContain("STOCK");
      expect(item!.capabilities).toContain("ORDER_CREATE");
    });
  });
});

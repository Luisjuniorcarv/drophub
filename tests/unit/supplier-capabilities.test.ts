import { describe, it, expect, beforeEach } from "vitest";
import {
  ALL_SUPPLIER_CAPABILITIES,
  SupplierCapability,
  isTransientIntegrationError,
  adapterSupportsCapability,
} from "@/modules/suppliers/types";
import {
  listRegisteredProviders,
  getProviderDefinition,
  getSupplierAdapter,
  UnconfiguredSupplierAdapter,
} from "@/modules/suppliers/factory";
import { TestSupplierAdapter } from "@/modules/suppliers/adapters/test-supplier-adapter";
import { SupplierObservability } from "@/modules/suppliers/observability";

describe("ETAPA 17.1 — Multi-Supplier Capabilities, Observability & Error Classification Unit Tests", () => {
  beforeEach(() => {
    SupplierObservability.clearLogs();
  });

  describe("1. Provider Registry & Metadata", () => {
    it("should list all registered provider definitions with their capabilities", () => {
      const providers = listRegisteredProviders();
      expect(providers.length).toBeGreaterThanOrEqual(3);

      const testProvider = providers.find((p) => p.key === "TEST");
      expect(testProvider).toBeDefined();
      expect(testProvider!.isMock).toBe(true);
      expect(testProvider!.isAvailable).toBe(true);
      expect(testProvider!.capabilities).toEqual(ALL_SUPPLIER_CAPABILITIES);

      const genericRest = providers.find((p) => p.key === "GENERIC_REST");
      expect(genericRest).toBeDefined();
      expect(genericRest!.isMock).toBe(false);
      expect(genericRest!.isAvailable).toBe(true);
      expect(genericRest!.capabilities).toContain("PRODUCTS");
      expect(genericRest!.capabilities).toContain("STOCK");
      expect(genericRest!.capabilities).toContain("ORDER_CREATE");
    });

    it("should retrieve provider definition by key case-insensitively", () => {
      const p1 = getProviderDefinition("test");
      expect(p1).toBeDefined();
      expect(p1!.key).toBe("TEST");

      const p2 = getProviderDefinition("GENERIC_REST");
      expect(p2).toBeDefined();
      expect(p2!.key).toBe("GENERIC_REST");

      const unknown = getProviderDefinition("UNKNOWN_PROVIDER_XYZ");
      expect(unknown).toBeUndefined();
    });
  });

  describe("2. SupplierAdapter Capabilities & Contract", () => {
    it("should verify capabilities on TestSupplierAdapter and allow selective capability configuration", () => {
      const adapter = new TestSupplierAdapter();
      expect(adapter.isMock).toBe(true);

      // Default supports all capabilities
      for (const cap of ALL_SUPPLIER_CAPABILITIES) {
        expect(adapter.hasCapability(cap)).toBe(true);
        expect(adapterSupportsCapability(adapter, cap)).toBe(true);
      }

      // Restrict capabilities
      adapter.setSupportedCapabilities(["ORDER_CREATE", "ORDER_STATUS"]);
      expect(adapter.hasCapability("ORDER_CREATE")).toBe(true);
      expect(adapter.hasCapability("ORDER_STATUS")).toBe(true);
      expect(adapter.hasCapability("PRODUCTS")).toBe(false);
      expect(adapter.hasCapability("ORDER_CANCEL")).toBe(false);
    });

    it("should reject operations gracefully when adapter does not support the capability", async () => {
      const adapter = new TestSupplierAdapter();
      adapter.setSupportedCapabilities(["ORDER_CREATE", "ORDER_STATUS"]);

      // Calling unsupported getProducts
      const prodRes = await adapter.getProducts();
      expect(prodRes.success).toBe(false);
      expect(prodRes.errorMessage).toContain("PRODUCTS");

      // Calling unsupported getStock
      const stockRes = await adapter.getStock({ skus: ["SKU-001"] });
      expect(stockRes.success).toBe(false);
      expect(stockRes.errorMessage).toContain("STOCK");

      // Calling unsupported cancelOrder
      const cancelRes = await adapter.cancelOrder({ externalOrderId: "EXT-1", reason: "Test" });
      expect(cancelRes.success).toBe(false);
      expect(cancelRes.errorMessage).toContain("ORDER_CANCEL");

      // Calling supported createOrder
      const orderRes = await adapter.createOrder({
        fulfillmentOrderId: "ful-1",
        orderNumber: "DH-100",
        supplierId: "sup-1",
        supplierName: "Test Sup",
        recipient: { name: "John", street: "Main St", city: "SP", state: "SP", postalCode: "01000-000" },
        items: [{ sku: "SKU-1", name: "Item", quantity: 1, unitCost: 10 }],
      });
      expect(orderRes.success).toBe(true);
      expect(orderRes.status).toBe("ACKNOWLEDGED");
    });

    it("should handle UnconfiguredSupplierAdapter returning NOT_CONFIGURED without network calls", async () => {
      const unconfigured = new UnconfiguredSupplierAdapter("BLING");
      expect(unconfigured.isMock).toBe(false);

      for (const cap of ALL_SUPPLIER_CAPABILITIES) {
        expect(unconfigured.hasCapability(cap)).toBe(false);
      }

      const testConn = await unconfigured.testConnection();
      expect(testConn.success).toBe(false);
      expect(testConn.category).toBe("NOT_CONFIGURED");

      const prodRes = await unconfigured.getProducts();
      expect(prodRes.success).toBe(false);
      expect(prodRes.category).toBe("NOT_CONFIGURED");

      const orderRes = await unconfigured.createOrder();
      expect(orderRes.success).toBe(false);
      expect(orderRes.category).toBe("NOT_CONFIGURED");
    });
  });

  describe("3. Error Categorization & Retry Eligibility", () => {
    it("should properly classify transient vs permanent integration errors", () => {
      // Transient (retryable)
      expect(isTransientIntegrationError("TIMEOUT")).toBe(true);
      expect(isTransientIntegrationError("RATE_LIMITED")).toBe(true);
      expect(isTransientIntegrationError("PROVIDER_UNAVAILABLE")).toBe(true);

      // Permanent (non-retryable)
      expect(isTransientIntegrationError("NOT_CONFIGURED")).toBe(false);
      expect(isTransientIntegrationError("OPERATION_NOT_SUPPORTED")).toBe(false);
      expect(isTransientIntegrationError("INVALID_CREDENTIALS")).toBe(false);
      expect(isTransientIntegrationError("AUTHENTICATION_FAILED")).toBe(false);
      expect(isTransientIntegrationError("ORDER_NOT_FOUND")).toBe(false);
      expect(isTransientIntegrationError("PROVIDER_REJECTED")).toBe(false);
      expect(isTransientIntegrationError("UNKNOWN_ERROR")).toBe(false);
    });
  });

  describe("4. Observability & Secret Masking in Audit Logs", () => {
    it("should record operational audit logs with latency and correlationId", () => {
      const op = SupplierObservability.startOperation("TEST", "sup-123", "ORDER_CREATE");
      expect(op.correlationId).toMatch(/^sup-\d+-[a-z0-9]+/);

      const log = op.finish("SUCCESS");
      expect(log.provider).toBe("TEST");
      expect(log.supplierId).toBe("sup-123");
      expect(log.operation).toBe("ORDER_CREATE");
      expect(log.result).toBe("SUCCESS");
      expect(log.durationMs).toBeGreaterThanOrEqual(0);

      const auditLogs = SupplierObservability.getAuditLogs("sup-123");
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0].correlationId).toBe(op.correlationId);
    });

    it("should sanitize and mask any sensitive tokens in error messages before logging", () => {
      const op = SupplierObservability.startOperation("GENERIC_REST", "sup-456", "TEST_CONNECTION");
      const leakAttempt = "Falha de autenticação com Bearer eyJhbGciOiJIUzI1NiJ9.secret e key=sk_live_123456789";

      const log = op.finish("FAILURE", {
        category: "AUTHENTICATION_FAILED",
        errorMessage: leakAttempt,
      });

      expect(log.errorMessage).not.toContain("eyJhbGciOiJIUzI1NiJ9");
      expect(log.errorMessage).not.toContain("sk_live_123456789");
      expect(log.errorMessage).toContain("[MASKED_TOKEN]");
      expect(log.errorMessage).toContain("[MASKED_KEY]");
    });
  });
});

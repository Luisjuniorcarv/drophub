import { describe, it, expect } from "vitest";
import { TestSupplierAdapter } from "../../src/modules/fulfillment/adapters/test-supplier-adapter";
import { getSupplierAdapter } from "../../src/modules/fulfillment/supplier-factory";
import {
  CreateFulfillmentSchema,
  UpdateFulfillmentTrackingSchema,
  UpdateFulfillmentStatusSchema,
  SupplierWebhookSchema,
} from "../../src/lib/validators";
import { FulfillmentStatus } from "@prisma/client";

describe("Fulfillment & Supplier Integration Unit Tests", () => {
  describe("Supplier Factory", () => {
    it("should instantiate TestSupplierAdapter for TEST or default provider", () => {
      const adapter = getSupplierAdapter("TEST");
      expect(adapter.name).toBe("TEST_SUPPLIER");
      expect(adapter).toBeInstanceOf(TestSupplierAdapter);

      const defaultAdapter = getSupplierAdapter();
      expect(defaultAdapter.name).toBe("TEST_SUPPLIER");
      expect(defaultAdapter).toBeInstanceOf(TestSupplierAdapter);
    });

    it("should fallback gracefully to TestSupplierAdapter for unknown providers in dev/test", () => {
      const adapter = getSupplierAdapter("UNKNOWN_VENDOR");
      expect(adapter).toBeInstanceOf(TestSupplierAdapter);
    });
  });

  describe("TestSupplierAdapter", () => {
    it("should successfully submit fulfillment payload and return external ID", async () => {
      const adapter = new TestSupplierAdapter();
      const result = await adapter.createOrder({
        fulfillmentOrderId: "ful-test-123",
        orderNumber: "DH-2026-0001",
        supplierId: "sup-1",
        supplierName: "Test Supplier",
        recipient: {
          name: "Maria Silva",
          street: "Rua das Flores, 123",
          city: "São Paulo",
          state: "SP",
          postalCode: "01310-100",
        },
        items: [
          {
            sku: "PROD-A",
            name: "Fones de Ouvido Sem Fio",
            quantity: 2,
            unitCost: 45.0,
          },
        ],
      });

      expect(result.success).toBe(true);
      expect(result.externalOrderId).toMatch(/^EXT-DH-2026-0001-/);
      expect(result.supplierOrderNumber).toMatch(/^SUP-/);
      expect(result.status).toBe("ACKNOWLEDGED");
      expect(result.rawResponse).toBeDefined();
    });

    it("should simulate supplier rejection when configured to fail", async () => {
      const adapter = new TestSupplierAdapter({ shouldFail: true, failureErrorMessage: "Fornecedor sem estoque" });
      const result = await adapter.createOrder({
        fulfillmentOrderId: "ful-test-error",
        orderNumber: "DH-2026-0002",
        supplierId: "sup-1",
        supplierName: "Test Supplier",
        recipient: {
          name: "Error Test",
          street: "Rua Teste, 0",
          city: "São Paulo",
          state: "SP",
          postalCode: "01000-000",
        },
        items: [
          {
            sku: "FAIL_ITEM",
            name: "Item Falha",
            quantity: 1,
            unitCost: 10.0,
          },
        ],
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe("FAILED");
      expect(result.errorMessage).toBe("Fornecedor sem estoque");
    });

    it("should query fulfillment status and tracking info when shipped", async () => {
      const adapter = new TestSupplierAdapter({ simulatedStatus: FulfillmentStatus.SHIPPED });
      adapter.setCustomTracking("BR999999999BR", "Correios");

      const statusRes = await adapter.getOrderStatus({ externalOrderId: "EXT-12345" });
      expect(statusRes.success).toBe(true);
      expect(statusRes.status).toBe(FulfillmentStatus.SHIPPED);
      expect(statusRes.trackingNumber).toBe("BR999999999BR");
      expect(statusRes.carrier).toBe("Correios");
      expect(statusRes.trackingUrl).toContain("correios.com.br");
    });

    it("should cancel fulfillment order at supplier", async () => {
      const adapter = new TestSupplierAdapter();
      const cancelRes = await adapter.cancelOrder({ externalOrderId: "EXT-12345", reason: "Cliente cancelou" });
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.cancelled).toBe(true);
    });
  });

  describe("Fulfillment Validation Schemas", () => {
    it("should validate CreateFulfillmentSchema with valid orderId", () => {
      const valid = { orderId: "clx1234567890abcdef" };
      const parsed = CreateFulfillmentSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("should reject CreateFulfillmentSchema with empty orderId", () => {
      const invalid = { orderId: "" };
      const parsed = CreateFulfillmentSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("should validate UpdateFulfillmentTrackingSchema with tracking code and carrier", () => {
      const valid = {
        trackingNumber: "BR123456789BR",
        carrier: "Correios",
        trackingUrl: "https://rastreio.exemplo.com/BR123456789BR",
      };
      const parsed = UpdateFulfillmentTrackingSchema.safeParse(valid);
      expect(parsed.success).toBe(true);
    });

    it("should reject UpdateFulfillmentTrackingSchema with missing trackingNumber", () => {
      const invalid = {
        carrier: "Correios",
      };
      const parsed = UpdateFulfillmentTrackingSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("should validate UpdateFulfillmentStatusSchema with valid status", () => {
      const validStatuses = [
        "PENDING",
        "SUBMITTED",
        "ACKNOWLEDGED",
        "SHIPPED",
        "DELIVERED",
        "FAILED",
        "CANCELLED",
      ];

      for (const st of validStatuses) {
        const parsed = UpdateFulfillmentStatusSchema.safeParse({ status: st, reason: "Status update test" });
        expect(parsed.success).toBe(true);
      }
    });

    it("should reject UpdateFulfillmentStatusSchema with invalid status value", () => {
      const invalid = { status: "FLYING_TO_MARS" };
      const parsed = UpdateFulfillmentStatusSchema.safeParse(invalid);
      expect(parsed.success).toBe(false);
    });

    it("should validate SupplierWebhookSchema", () => {
      const validWebhook = {
        event: "TRACKING_UPDATED",
        externalOrderId: "ext_123",
        supplierOrderNumber: "sup_123",
        trackingNumber: "BR0001",
        carrier: "LOGGI",
      };
      const parsed = SupplierWebhookSchema.safeParse(validWebhook);
      expect(parsed.success).toBe(true);
    });
  });
});

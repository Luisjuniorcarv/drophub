import { describe, it, expect } from "vitest";
import {
  RestockInputSchema,
  StockAdjustmentSchema,
  StockMovementFilterSchema,
} from "../../src/lib/validators";
import { DOMAIN_EVENTS, createDomainEvent } from "../../src/modules/automations/events";

describe("Stock Module Unit Tests", () => {
  describe("Validators", () => {
    describe("RestockInputSchema", () => {
      it("should accept valid restock payload", () => {
        const input = {
          productId: "prod-123",
          quantity: 25,
          unitCost: 19.9,
          reason: "Entrada de lote fornecedor",
        };
        const result = RestockInputSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should reject zero or negative quantity", () => {
        expect(RestockInputSchema.safeParse({ productId: "p1", quantity: 0 }).success).toBe(false);
        expect(RestockInputSchema.safeParse({ productId: "p1", quantity: -5 }).success).toBe(false);
      });

      it("should reject missing productId", () => {
        expect(RestockInputSchema.safeParse({ quantity: 10 }).success).toBe(false);
      });
    });

    describe("StockAdjustmentSchema", () => {
      it("should accept valid adjustment payload", () => {
        const input = {
          productId: "prod-123",
          newBalance: 15,
          reason: "Contagem física de inventário anual",
          type: "ADJUSTMENT",
        };
        const result = StockAdjustmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should accept zero as valid new balance", () => {
        const input = {
          productId: "prod-123",
          newBalance: 0,
          reason: "Produto extraviado ou avariado",
        };
        const result = StockAdjustmentSchema.safeParse(input);
        expect(result.success).toBe(true);
      });

      it("should reject negative newBalance", () => {
        const result = StockAdjustmentSchema.safeParse({
          productId: "prod-123",
          newBalance: -1,
          reason: "Motivo qualquer",
        });
        expect(result.success).toBe(false);
      });

      it("should reject reason with less than 3 characters", () => {
        const result = StockAdjustmentSchema.safeParse({
          productId: "prod-123",
          newBalance: 10,
          reason: "ab",
        });
        expect(result.success).toBe(false);
      });
    });

    describe("StockMovementFilterSchema", () => {
      it("should parse valid filters and apply defaults", () => {
        const result = StockMovementFilterSchema.safeParse({
          type: "SALE",
          page: "2",
          limit: "25",
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.type).toBe("SALE");
          expect(result.data.page).toBe(2);
          expect(result.data.limit).toBe(25);
        }
      });
    });
  });

  describe("Stock Domain Events", () => {
    it("should define all stock lifecycle domain events", () => {
      expect(DOMAIN_EVENTS.STOCK_RESTOCKED).toBe("STOCK_RESTOCKED");
      expect(DOMAIN_EVENTS.STOCK_ADJUSTED).toBe("STOCK_ADJUSTED");
      expect(DOMAIN_EVENTS.STOCK_LOW).toBe("STOCK_LOW");
      expect(DOMAIN_EVENTS.STOCK_OUT).toBe("STOCK_OUT");
      expect(DOMAIN_EVENTS.STOCK_RETURNED).toBe("STOCK_RETURNED");
    });

    it("should create well-formed event envelope for stock restock", () => {
      const event = createDomainEvent({
        type: DOMAIN_EVENTS.STOCK_RESTOCKED,
        entityType: "Product",
        entityId: "prod-123",
        data: {
          productId: "prod-123",
          quantity: 50,
          balanceBefore: 10,
          balanceAfter: 60,
        },
      });

      expect(event.id).toBeDefined();
      expect(event.type).toBe("STOCK_RESTOCKED");
      expect(event.entity.type).toBe("Product");
      expect(event.entity.id).toBe("prod-123");
      expect(event.data.balanceAfter).toBe(60);
      expect(event.occurredAt).toBeDefined();
    });
  });
});

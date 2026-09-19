import { describe, it, expect } from "vitest";
import { OrderStatus } from "@prisma/client";
import { isValidStatusTransition, VALID_ORDER_TRANSITIONS } from "@/modules/orders/state-machine";

describe("Order State Machine Transitions", () => {
  it("should allow natural progression of order lifecycle", () => {
    expect(isValidStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.PAID)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.PROCESSING)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PROCESSING, OrderStatus.AWAITING_SUPPLIER)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.AWAITING_SUPPLIER, OrderStatus.SENT_TO_SUPPLIER)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.SENT_TO_SUPPLIER, OrderStatus.SHIPPED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.SHIPPED, OrderStatus.DELIVERED)).toBe(true);
  });

  it("should allow cancellation from unpaid and early processing states", () => {
    expect(isValidStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PROCESSING, OrderStatus.CANCELLED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.AWAITING_SUPPLIER, OrderStatus.CANCELLED)).toBe(true);
  });

  it("should allow refund flows from paid, shipped, or delivered states", () => {
    expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.REFUNDED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.PROCESSING, OrderStatus.REFUNDED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.SHIPPED, OrderStatus.REFUNDED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.REFUNDED)).toBe(true);
  });

  it("should block invalid retrograde or illogical transitions", () => {
    // Cannot deliver unpaid order directly
    expect(isValidStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.DELIVERED)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.AWAITING_PAYMENT, OrderStatus.SHIPPED)).toBe(false);

    // Terminal state CANCELLED cannot transition anywhere
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.PAID)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.PROCESSING)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.SHIPPED)).toBe(false);

    // Terminal state REFUNDED cannot transition anywhere
    expect(isValidStatusTransition(OrderStatus.REFUNDED, OrderStatus.PAID)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.REFUNDED, OrderStatus.DELIVERED)).toBe(false);

    // Cannot revert DELIVERED to AWAITING_PAYMENT
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.AWAITING_PAYMENT)).toBe(false);
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.PROCESSING)).toBe(false);
  });

  it("should accept transition to the exact same status as a no-op", () => {
    expect(isValidStatusTransition(OrderStatus.PAID, OrderStatus.PAID)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.DELIVERED, OrderStatus.DELIVERED)).toBe(true);
    expect(isValidStatusTransition(OrderStatus.CANCELLED, OrderStatus.CANCELLED)).toBe(true);
  });

  it("should guarantee terminal states have empty transition arrays", () => {
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.CANCELLED]).toEqual([]);
    expect(VALID_ORDER_TRANSITIONS[OrderStatus.REFUNDED]).toEqual([]);
  });
});

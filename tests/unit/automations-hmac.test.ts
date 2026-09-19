import { describe, it, expect } from "vitest";
import {
  generateWebhookSignature,
  verifyWebhookSignature,
  generateWebhookSecret,
} from "../../src/modules/automations/hmac";
import {
  calculateNextRetryDate,
  isWebhookSubscribedToEvent,
} from "../../src/modules/automations/dispatcher";
import {
  DOMAIN_EVENTS,
  createDomainEvent,
} from "../../src/modules/automations/events";

describe("Automations & Webhooks Unit Tests", () => {
  const secret = "test_secret_key_12345678";
  const payload = { orderId: "ord-123", amount: 199.9, event: "ORDER_CREATED" };

  it("should generate a valid sha256 hex signature", () => {
    const signature = generateWebhookSignature(payload, secret);
    expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
  });

  it("should verify a matching signature as valid", () => {
    const signature = generateWebhookSignature(payload, secret);
    const isValid = verifyWebhookSignature(payload, secret, signature);
    expect(isValid).toBe(true);
  });

  it("should reject tampered payload", () => {
    const signature = generateWebhookSignature(payload, secret);
    const tamperedPayload = { ...payload, amount: 999.99 };
    const isValid = verifyWebhookSignature(tamperedPayload, secret, signature);
    expect(isValid).toBe(false);
  });

  it("should reject wrong secret", () => {
    const signature = generateWebhookSignature(payload, secret);
    const isValid = verifyWebhookSignature(payload, "different_secret_87654321", signature);
    expect(isValid).toBe(false);
  });

  it("should reject empty or malformed signatures without throwing", () => {
    expect(verifyWebhookSignature(payload, secret, "")).toBe(false);
    expect(verifyWebhookSignature(payload, secret, "invalid_sig")).toBe(false);
    expect(verifyWebhookSignature(payload, "", "sha256=1234")).toBe(false);
  });

  it("should generate random webhook secrets with whsec_ prefix", () => {
    const s1 = generateWebhookSecret();
    const s2 = generateWebhookSecret();
    expect(s1).toMatch(/^whsec_[a-f0-9]{48}$/);
    expect(s2).toMatch(/^whsec_[a-f0-9]{48}$/);
    expect(s1).not.toBe(s2);
  });

  it("should calculate progressive exponential backoff retry dates", () => {
    const now = Date.now();
    const retry1 = calculateNextRetryDate(1).getTime();
    const retry2 = calculateNextRetryDate(2).getTime();
    const retry3 = calculateNextRetryDate(3).getTime();

    expect(retry1).toBeGreaterThanOrEqual(now + 50 * 1000); // approx +1 min
    expect(retry2).toBeGreaterThanOrEqual(now + 4 * 60 * 1000); // approx +5 min
    expect(retry3).toBeGreaterThanOrEqual(now + 14 * 60 * 1000); // approx +15 min
  });

  it("should check webhook event subscriptions correctly", () => {
    expect(isWebhookSubscribedToEvent(["*"], DOMAIN_EVENTS.ORDER_CREATED)).toBe(true);
    expect(isWebhookSubscribedToEvent(["*"], DOMAIN_EVENTS.PRODUCT_CREATED)).toBe(true);
    expect(
      isWebhookSubscribedToEvent(["ORDER_CREATED", "ORDER_PAID"], DOMAIN_EVENTS.ORDER_CREATED)
    ).toBe(true);
    expect(
      isWebhookSubscribedToEvent(["ORDER_CREATED", "ORDER_PAID"], DOMAIN_EVENTS.ORDER_CANCELLED)
    ).toBe(false);
  });

  it("should create standardized domain event envelope", () => {
    const event = createDomainEvent({
      type: DOMAIN_EVENTS.ORDER_CREATED,
      entityType: "Order",
      entityId: "order-abc",
      data: { orderNumber: "DH-1001", total: 150 },
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe(DOMAIN_EVENTS.ORDER_CREATED);
    expect(event.source).toBe("drophub");
    expect(event.entity.type).toBe("Order");
    expect(event.entity.id).toBe("order-abc");
    expect(event.data.orderNumber).toBe("DH-1001");
    expect(new Date(event.occurredAt).getTime()).toBeGreaterThan(0);
  });
});

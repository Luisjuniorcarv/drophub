import { describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET as getFulfillmentCron, POST as postFulfillmentCron } from "@/app/api/cron/fulfillment/route";
import { GET as getOutboxCron, POST as postOutboxCron } from "@/app/api/cron/outbox/route";

describe("ETAPA 15 — Cron Security & Authorization Integration Tests", () => {
  const TEST_SECRET = "super_secure_cron_secret_for_tests_2026";

  beforeEach(() => {
    process.env.CRON_SECRET = TEST_SECRET;
  });

  it("1. should reject fulfillment cron with 401 when no authorization is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/fulfillment", {
      method: "POST",
    });

    const res = await postFulfillmentCron(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toContain("Não autorizado");
  });

  it("2. should reject fulfillment cron with 401 when an invalid secret is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/fulfillment", {
      method: "POST",
      headers: {
        authorization: "Bearer invalid_secret_token_123",
      },
    });

    const res = await postFulfillmentCron(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toContain("Não autorizado");
  });

  it("3. should authorize fulfillment cron with 200 when valid Bearer token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/fulfillment?batch=5&sync=false", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await postFulfillmentCron(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.data).toBeDefined();
  });

  it("4. should authorize fulfillment cron with 200 when valid x-cron-secret header is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/fulfillment?batch=5&sync=false", {
      method: "GET",
      headers: {
        "x-cron-secret": TEST_SECRET,
      },
    });

    const res = await getFulfillmentCron(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("5. should reject outbox cron with 401 when invalid secret is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/outbox", {
      method: "POST",
      headers: {
        "x-cron-secret": "wrong_secret",
      },
    });

    const res = await postOutboxCron(req);
    expect(res.status).toBe(401);
  });

  it("6. should authorize outbox cron with 200 when valid Bearer token is provided", async () => {
    const req = new NextRequest("http://localhost:3000/api/cron/outbox?limit=5", {
      method: "POST",
      headers: {
        authorization: `Bearer ${TEST_SECRET}`,
      },
    });

    const res = await postOutboxCron(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
  });
});

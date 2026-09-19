import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET as getHealth } from "@/app/api/health/route";
import { GET as getReady } from "@/app/api/ready/route";

describe("ETAPA 13/15 — Production Healthcheck & Readiness Tests", () => {
  it("1. should respond healthy for liveness probe via /api/health", async () => {
    const req = new NextRequest("http://localhost:3000/api/health");
    const res = await getHealth(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("healthy");
    expect(data.service).toBe("drophub-api");
    expect(data.version).toBe("1.0.0");
  });

  it("2. should verify database connectivity for readiness probe via /api/health?type=readiness", async () => {
    const req = new NextRequest("http://localhost:3000/api/health?type=readiness");
    const res = await getHealth(req);

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ready");
    expect(data.database).toBe("connected");
  });

  it("3. should verify database connectivity via dedicated /api/ready endpoint", async () => {
    const res = await getReady();

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe("ready");
    expect(data.database).toBe("connected");
    expect(data.service).toBe("drophub-api");
  });
});

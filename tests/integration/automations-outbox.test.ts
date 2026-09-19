import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { prisma } from "../../src/lib/prisma";
import { publishDomainEvent } from "../../src/modules/automations/outbox";
import { processOutboxEvents } from "../../src/modules/automations/dispatcher";
import { DOMAIN_EVENTS } from "../../src/modules/automations/events";
import http from "http";

describe("Transactional Outbox & Fault Decoupling Integration Tests", () => {
  let mockServer: http.Server;
  let mockServerPort: number;
  let mockServerCallCount = 0;
  let mockServerShouldFail = false;

  beforeEach(async () => {
    mockServerCallCount = 0;
    await prisma.webhookDelivery.deleteMany({});
    await prisma.webhookEndpoint.deleteMany({
      where: { name: { startsWith: "TEST_" } },
    });
    await prisma.outboxEvent.deleteMany({});
  });

  beforeAll(async () => {
    // Iniciar mock server HTTP para simular n8n / endpoints externos
    mockServer = http.createServer((req, res) => {
      mockServerCallCount++;
      let body = "";
      req.on("data", (chunk) => (body += chunk));
      req.on("end", () => {
        if (mockServerShouldFail) {
          res.writeHead(500, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ error: "Internal n8n Error Simulated" }));
        } else {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ received: true, count: mockServerCallCount }));
        }
      });
    });

    await new Promise<void>((resolve) => {
      mockServer.listen(0, () => {
        const address = mockServer.address() as any;
        mockServerPort = address.port;
        resolve();
      });
    });
  });

  afterAll(async () => {
    mockServer.close();
    // Limpeza de testes
    await prisma.webhookDelivery.deleteMany({
      where: { webhook: { name: { startsWith: "TEST_" } } },
    });
    await prisma.webhookEndpoint.deleteMany({
      where: { name: { startsWith: "TEST_" } },
    });
    await prisma.outboxEvent.deleteMany({
      where: { entityType: "TestOrder" },
    });
  });

  it("should write OutboxEvent atomically inside a Prisma transaction", async () => {
    const testEntityId = `test-ent-${Date.now()}`;

    const event = await prisma.$transaction(async (tx) => {
      return publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_CREATED,
        entityType: "TestOrder",
        entityId: testEntityId,
        data: { testNumber: "DH-TEST-1", amount: 100 },
      });
    });

    expect(event.id).toBeDefined();
    expect(event.type).toBe(DOMAIN_EVENTS.ORDER_CREATED);

    // Verificar se persistiu no PostgreSQL
    const saved = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(saved).not.toBeNull();
    expect(saved?.eventType).toBe(DOMAIN_EVENTS.ORDER_CREATED);
    expect(saved?.status).toBe("PENDING");
    expect(saved?.attempts).toBe(0);
    expect(saved?.entityId).toBe(testEntityId);
  });

  it("should dispatch outbox event successfully when external endpoint is healthy", async () => {
    mockServerShouldFail = false;
    const testEntityId = `test-ent-${Date.now()}`;

    // Cadastrar webhook apontando para o mock server
    const webhook = await prisma.webhookEndpoint.create({
      data: {
        name: "TEST_HEALTHY_N8N",
        url: `http://localhost:${mockServerPort}/webhook/test`,
        secret: "whsec_test_secret_12345678",
        events: ["*"],
        active: true,
      },
    });

    // Publicar evento
    await prisma.$transaction(async (tx) => {
      await publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_CREATED,
        entityType: "TestOrder",
        entityId: testEntityId,
        data: { testNumber: "DH-TEST-HEALTHY", amount: 250 },
      });
    });

    // Processar outbox
    const result = await processOutboxEvents(10);
    expect(result.processed).toBeGreaterThan(0);

    // Verificar entrega registrada no banco
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { webhookId: webhook.id },
      orderBy: { createdAt: "desc" },
    });

    expect(delivery).not.toBeNull();
    expect(delivery?.status).toBe("SUCCESS");
    expect(delivery?.statusCode).toBe(200);
  });

  it("CRITICAL: when external webhook fails with 500, OutboxEvent marks failure/retry without corrupting data", async () => {
    mockServerShouldFail = true;
    const testEntityId = `test-fail-${Date.now()}`;

    // Cadastrar webhook com falha
    const webhook = await prisma.webhookEndpoint.create({
      data: {
        name: "TEST_FAILING_N8N",
        url: `http://localhost:${mockServerPort}/webhook/fail`,
        secret: "whsec_test_fail_secret_87654321",
        events: [DOMAIN_EVENTS.ORDER_CREATED],
        active: true,
      },
    });

    // Publicar evento
    const createdEvent = await prisma.$transaction(async (tx) => {
      return publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.ORDER_CREATED,
        entityType: "TestOrder",
        entityId: testEntityId,
        data: { testNumber: "DH-TEST-FAIL", amount: 999 },
      });
    });

    // Processar outbox (o webhook remoto retornará HTTP 500)
    await processOutboxEvents(10);

    // 1. O evento de outbox deve ter attempts incrementado e agendado para retry
    const updatedEvent = await prisma.outboxEvent.findUnique({
      where: { id: createdEvent.id },
    });

    expect(updatedEvent).not.toBeNull();
    expect(updatedEvent?.attempts).toBe(1);
    expect(updatedEvent?.status).toBe("PENDING"); // Pronto para próxima tentativa
    expect(updatedEvent?.nextAttemptAt).not.toBeNull();

    // 2. A entrega deve registrar HTTP 500 e mensagem de erro
    const delivery = await prisma.webhookDelivery.findFirst({
      where: { eventId: createdEvent.id, webhookId: webhook.id },
    });

    expect(delivery).not.toBeNull();
    expect(delivery?.status).toBe("FAILED");
    expect(delivery?.statusCode).toBe(500);
    expect(delivery?.errorMessage).toContain("500");
  });

  it("should transition OutboxEvent to FAILED after reaching maxAttempts (3) and stop automatic retry", async () => {
    mockServerShouldFail = true;
    const testEntityId = `test-maxfail-${Date.now()}`;

    // Cadastrar webhook com falha
    const webhook = await prisma.webhookEndpoint.create({
      data: {
        name: "TEST_MAXFAIL_N8N",
        url: `http://localhost:${mockServerPort}/webhook/maxfail`,
        secret: "whsec_test_maxfail_123",
        events: [DOMAIN_EVENTS.ORDER_CREATED],
        active: true,
      },
    });

    // Publicar evento já na 2ª tentativa (attempts = 2)
    const event = await prisma.outboxEvent.create({
      data: {
        eventType: DOMAIN_EVENTS.ORDER_CREATED,
        entityType: "TestOrder",
        entityId: testEntityId,
        payload: { test: "max_attempts_test" },
        status: "PENDING",
        attempts: 2,
        maxAttempts: 3,
        nextAttemptAt: new Date(Date.now() - 1000), // pronto para processar
      },
    });

    // Processar outbox (3ª tentativa que irá falhar)
    await processOutboxEvents(10);

    const updated = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(updated).not.toBeNull();
    expect(updated?.attempts).toBe(3);
    expect(updated?.status).toBe("FAILED");
    expect(updated?.nextAttemptAt).toBeNull(); // Não agenda mais retentativas automáticas
  });

  it("should publish PAYMENT_APPROVED event when recording approved payments", async () => {
    const testPaymentId = `pay-${Date.now()}`;
    const event = await prisma.$transaction(async (tx) => {
      return publishDomainEvent(tx, {
        type: DOMAIN_EVENTS.PAYMENT_APPROVED,
        entityType: "Payment",
        entityId: testPaymentId,
        data: {
          paymentId: testPaymentId,
          orderId: "ord-test",
          orderNumber: "DH-PAY-TEST",
          gateway: "TEST_GATEWAY",
          method: "PIX",
          amount: 149.9,
          transactionId: "TX-TEST-123",
        },
      });
    });

    expect(event.type).toBe(DOMAIN_EVENTS.PAYMENT_APPROVED);
    expect(event.entity.type).toBe("Payment");
    expect(event.entity.id).toBe(testPaymentId);
    expect(event.data.amount).toBe(149.9);

    const saved = await prisma.outboxEvent.findUnique({ where: { id: event.id } });
    expect(saved).not.toBeNull();
    expect(saved?.eventType).toBe("PAYMENT_APPROVED");
  });
});

/**
 * DropHub - Standalone Outbox Worker
 * Executa o loop de despacho assíncrono da Transactional Outbox.
 * Compatível com Docker e EasyPanel (zero dependências externas como Redis/BullMQ).
 */

const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const prisma = new PrismaClient();

const POLL_INTERVAL_MS = parseInt(process.env.OUTBOX_POLL_INTERVAL_MS || "5000", 10);
const BATCH_SIZE = parseInt(process.env.OUTBOX_BATCH_SIZE || "20", 10);

let isRunning = true;
let isProcessing = false;

function calculateNextRetryDate(attemptNumber) {
  const delaysInMinutes = [1, 5, 15, 60];
  const delay = delaysInMinutes[Math.min(attemptNumber - 1, delaysInMinutes.length - 1)] || 15;
  return new Date(Date.now() + delay * 60 * 1000);
}

function generateWebhookSignature(payload, secret) {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(content, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

function isWebhookSubscribedToEvent(subscribedEvents, eventType) {
  if (subscribedEvents.includes("*")) return true;
  return subscribedEvents.includes(eventType);
}

async function sendWebhookPayload(params) {
  const { url, secret, payload, deliveryId, eventId, eventType } = params;
  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);
  const timestamp = new Date().toISOString();

  const headersSent = {
    "Content-Type": "application/json",
    "User-Agent": "DropHub-Outbox-Worker/1.0",
    "X-DropHub-Signature": signature,
    "X-DropHub-Event": eventType,
    "X-DropHub-Event-Id": eventId,
    "X-DropHub-Delivery-Id": deliveryId,
    "X-DropHub-Timestamp": timestamp,
  };

  const startTime = Date.now();
  let statusCode = null;
  let responseBody = null;
  let errorMessage = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(url, {
      method: "POST",
      headers: headersSent,
      body: payloadString,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    statusCode = response.status;
    const durationMs = Date.now() - startTime;

    const rawText = await response.text().catch(() => "");
    responseBody = rawText ? sanitizeForDb(rawText.slice(0, 1000)) : null;

    if (response.ok) {
      success = true;
    } else {
      errorMessage = `HTTP ${response.status} ${response.statusText}`;
    }

    return { success, statusCode, durationMs, responseBody, errorMessage, headersSent };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    errorMessage = err.name === "AbortError" ? "Timeout 6000ms" : sanitizeForDb(err.message);
    return { success: false, statusCode: null, durationMs, responseBody: null, errorMessage, headersSent };
  }
}

function sanitizeForDb(str) {
  if (!str) return null;
  return String(str).replace(/[\uD800-\uDFFF]/g, '').replace(/[^\x00-\x7F\xA0-\xFF]/g, '');
}

async function processOutboxBatch() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const now = new Date();

    const pendingEvents = await prisma.outboxEvent.findMany({
      where: {
        status: "PENDING",
        OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: now } }],
      },
      take: BATCH_SIZE,
      orderBy: { createdAt: "asc" },
    });

    if (pendingEvents.length === 0) {
      isProcessing = false;
      return;
    }

    const activeWebhooks = await prisma.webhookEndpoint.findMany({
      where: { active: true },
    });

    for (const event of pendingEvents) {
      const matchingWebhooks = activeWebhooks.filter((wh) =>
        isWebhookSubscribedToEvent(wh.events, event.eventType)
      );

      if (matchingWebhooks.length === 0) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: { status: "PROCESSED", processedAt: new Date() },
        });
        continue;
      }

      let allDeliveriesSucceeded = true;
      const currentAttempt = event.attempts + 1;

      for (const webhook of matchingWebhooks) {
        const deliveryId = crypto.randomUUID();

        const result = await sendWebhookPayload({
          url: webhook.url,
          secret: webhook.secret,
          payload: event.payload,
          deliveryId,
          eventId: event.id,
          eventType: event.eventType,
        });

        await prisma.webhookDelivery.create({
          data: {
            id: deliveryId,
            eventId: event.id,
            webhookId: webhook.id,
            status: result.success ? "SUCCESS" : "FAILED",
            attemptNumber: currentAttempt,
            statusCode: result.statusCode,
            durationMs: result.durationMs,
            requestHeaders: result.headersSent,
            requestBody: event.payload,
            responseBody: result.responseBody,
            errorMessage: result.errorMessage,
            deliveredAt: result.success ? new Date() : null,
          },
        });

        await prisma.webhookEndpoint.update({
          where: { id: webhook.id },
          data: {
            lastTriggeredAt: new Date(),
            lastDeliveryStatus: result.success ? "SUCCESS" : "FAILED",
          },
        });

        if (!result.success) {
          allDeliveriesSucceeded = false;
        }
      }

      if (allDeliveriesSucceeded) {
        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: "PROCESSED",
            attempts: currentAttempt,
            processedAt: new Date(),
            errorMessage: null,
          },
        });
        console.log(`[OUTBOX_WORKER] Evento ${event.eventType} (${event.id.slice(0, 8)}) processado com sucesso.`);
      } else {
        const isMaxReached = currentAttempt >= event.maxAttempts;
        const nextRetry = isMaxReached ? null : calculateNextRetryDate(currentAttempt);

        await prisma.outboxEvent.update({
          where: { id: event.id },
          data: {
            status: isMaxReached ? "FAILED" : "PENDING",
            attempts: currentAttempt,
            nextAttemptAt: nextRetry,
            errorMessage: isMaxReached ? "Limite máximo de tentativas atingido." : "Falha na entrega, agendado retry.",
          },
        });

        console.warn(
          `[OUTBOX_WORKER] Evento ${event.eventType} falhou (tentativa ${currentAttempt}/${event.maxAttempts}). Próxima tentativa: ${nextRetry ? nextRetry.toISOString() : "NENHUMA (FAILED)"}`
        );
      }
    }
  } catch (err) {
    console.error("[OUTBOX_WORKER_ERROR]", err);
  } finally {
    isProcessing = false;
  }
}

async function startWorker() {
  console.log("==================================================");
  console.log("  DROPHUB - OUTBOX BACKGROUND WORKER INICIADO");
  console.log(`  Intervalo de varredura: ${POLL_INTERVAL_MS}ms`);
  console.log(`  Tamanho do lote: ${BATCH_SIZE} eventos`);
  console.log("==================================================");

  while (isRunning) {
    await processOutboxBatch();
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  await prisma.$disconnect();
  console.log("[OUTBOX_WORKER] Finalizado com sucesso.");
}

process.on("SIGINT", () => {
  console.log("\n[OUTBOX_WORKER] Recebido SIGINT, encerrando graciosamente...");
  isRunning = false;
});

process.on("SIGTERM", () => {
  console.log("\n[OUTBOX_WORKER] Recebido SIGTERM, encerrando graciosamente...");
  isRunning = false;
});

if (require.main === module) {
  startWorker();
}

module.exports = { processOutboxBatch };

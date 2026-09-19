import { prisma } from "@/lib/prisma";
import { generateWebhookSignature } from "./hmac";
import { DOMAIN_EVENTS, createDomainEvent } from "./events";
import crypto from "crypto";

/**
 * Calcula próximo intervalo de retry com backoff exponencial
 */
export function calculateNextRetryDate(attemptNumber: number): Date {
  const delaysInMinutes = [1, 5, 15, 60]; // Tentativa 1: +1m, 2: +5m, 3: +15m, etc.
  const delay = delaysInMinutes[Math.min(attemptNumber - 1, delaysInMinutes.length - 1)] || 15;
  return new Date(Date.now() + delay * 60 * 1000);
}

/**
 * Verifica se um webhook está inscrito em determinado tipo de evento
 */
export function isWebhookSubscribedToEvent(
  subscribedEvents: string[],
  eventType: string
): boolean {
  if (subscribedEvents.includes("*")) return true;
  return subscribedEvents.includes(eventType);
}

/**
 * Executa uma entrega HTTP individual para um endpoint com HMAC e medição de latência
 */
export async function sendWebhookPayload(params: {
  url: string;
  secret: string;
  payload: any;
  deliveryId: string;
  eventId: string;
  eventType: string;
}): Promise<{
  success: boolean;
  statusCode: number | null;
  durationMs: number;
  responseBody: string | null;
  errorMessage: string | null;
  headersSent: Record<string, string>;
}> {
  const { url, secret, payload, deliveryId, eventId, eventType } = params;

  const payloadString = JSON.stringify(payload);
  const signature = generateWebhookSignature(payloadString, secret);
  const timestamp = new Date().toISOString();

  const headersSent: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "DropHub-Webhook-Dispatcher/1.0",
    "X-DropHub-Signature": signature,
    "X-DropHub-Event": eventType,
    "X-DropHub-Event-Id": eventId,
    "X-DropHub-Delivery-Id": deliveryId,
    "X-DropHub-Timestamp": timestamp,
  };

  const startTime = Date.now();
  let statusCode: number | null = null;
  let responseBody: string | null = null;
  let errorMessage: string | null = null;
  let success = false;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout max

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
    responseBody = rawText ? rawText.slice(0, 1000) : null; // truncar para log limpo

    if (response.ok) {
      success = true;
    } else {
      errorMessage = `Webhook respondeu com HTTP ${response.status} ${response.statusText}`;
    }

    return {
      success,
      statusCode,
      durationMs,
      responseBody,
      errorMessage,
      headersSent,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    errorMessage =
      err.name === "AbortError"
        ? "Timeout: Endpoint não respondeu em até 6000ms"
        : err.message || "Erro de conexão de rede";

    return {
      success: false,
      statusCode: null,
      durationMs,
      responseBody: null,
      errorMessage,
      headersSent,
    };
  }
}

/**
 * Processador principal da Fila de Eventos (Transactional Outbox)
 */
export async function processOutboxEvents(limit = 20) {
  const now = new Date();

  // Buscar eventos PENDING que atingiram o horário de disparo/retry
  const pendingEvents = await prisma.outboxEvent.findMany({
    where: {
      status: "PENDING",
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    take: limit,
    orderBy: { createdAt: "asc" },
  });

  if (pendingEvents.length === 0) {
    return { processed: 0, successful: 0, failed: 0 };
  }

  // Buscar todos os endpoints de webhook ativos
  const activeWebhooks = await prisma.webhookEndpoint.findMany({
    where: { active: true },
  });

  let successCount = 0;
  let failCount = 0;

  for (const event of pendingEvents) {
    // 1. Processar Handlers de Domínio Internos (ex: ORDER_PAID -> Fulfillment)
    try {
      if (event.eventType === DOMAIN_EVENTS.ORDER_PAID) {
        const orderId = event.entityId || (event.payload as any)?.orderId;
        if (orderId) {
          const { orchestratePaidOrderFulfillment } = await import("@/modules/fulfillment/service");
          await orchestratePaidOrderFulfillment(orderId);
        }
      }
    } catch (handlerErr: any) {
      console.error(`[INTERNAL_EVENT_DISPATCH_ERROR] Falha no handler interno para evento ${event.id} (${event.eventType}):`, handlerErr);
    }

    const matchingWebhooks = activeWebhooks.filter((wh) =>
      isWebhookSubscribedToEvent(wh.events, event.eventType)
    );

    // Se nenhum webhook estiver inscrito nesse evento, marca como processado
    if (matchingWebhooks.length === 0) {
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: "PROCESSED",
          processedAt: new Date(),
        },
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

      // Gravar histórico de auditoria da entrega
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
          requestBody: event.payload as any,
          responseBody: result.responseBody,
          errorMessage: result.errorMessage,
          deliveredAt: result.success ? new Date() : null,
        },
      });

      // Atualizar status do webhook endpoint
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
      successCount++;
    } else {
      const isMaxReached = currentAttempt >= event.maxAttempts;
      await prisma.outboxEvent.update({
        where: { id: event.id },
        data: {
          status: isMaxReached ? "FAILED" : "PENDING",
          attempts: currentAttempt,
          nextAttemptAt: isMaxReached ? null : calculateNextRetryDate(currentAttempt),
          errorMessage: "Falha na entrega para um ou mais webhooks",
        },
      });
      failCount++;
    }
  }

  return {
    processed: pendingEvents.length,
    successful: successCount,
    failed: failCount,
  };
}

/**
 * Dispara evento sintético de teste (PING) para validar conectividade de um webhook
 */
export async function testWebhookEndpoint(webhookId: string) {
  const webhook = await prisma.webhookEndpoint.findUnique({
    where: { id: webhookId },
  });

  if (!webhook) {
    throw new Error("Webhook não encontrado.");
  }

  const testEvent = createDomainEvent({
    type: DOMAIN_EVENTS.TEST_PING,
    entityType: "System",
    entityId: webhook.id,
    data: {
      message: "DropHub Webhook Verification Ping",
      timestamp: new Date().toISOString(),
      webhookName: webhook.name,
    },
  });

  const deliveryId = crypto.randomUUID();

  const result = await sendWebhookPayload({
    url: webhook.url,
    secret: webhook.secret,
    payload: testEvent,
    deliveryId,
    eventId: testEvent.id,
    eventType: DOMAIN_EVENTS.TEST_PING,
  });

  // Atualizar status do webhook
  await prisma.webhookEndpoint.update({
    where: { id: webhook.id },
    data: {
      lastTriggeredAt: new Date(),
      lastDeliveryStatus: result.success ? "SUCCESS" : "FAILED",
    },
  });

  return result;
}

/**
 * Reprocessa manualmente uma entrega de webhook anterior
 */
export async function redeliverWebhook(deliveryId: string) {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: {
      event: true,
      webhook: true,
    },
  });

  if (!delivery) {
    throw new Error("Registro de entrega não encontrado.");
  }

  const newDeliveryId = crypto.randomUUID();
  const nextAttempt = delivery.attemptNumber + 1;

  const result = await sendWebhookPayload({
    url: delivery.webhook.url,
    secret: delivery.webhook.secret,
    payload: delivery.event.payload,
    deliveryId: newDeliveryId,
    eventId: delivery.event.id,
    eventType: delivery.event.eventType,
  });

  // Criar novo registro de tentativa
  const newDelivery = await prisma.webhookDelivery.create({
    data: {
      id: newDeliveryId,
      eventId: delivery.event.id,
      webhookId: delivery.webhook.id,
      status: result.success ? "SUCCESS" : "FAILED",
      attemptNumber: nextAttempt,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
      requestHeaders: result.headersSent,
      requestBody: delivery.event.payload as any,
      responseBody: result.responseBody,
      errorMessage: result.errorMessage,
      deliveredAt: result.success ? new Date() : null,
    },
  });

  if (result.success) {
    await prisma.outboxEvent.update({
      where: { id: delivery.event.id },
      data: {
        status: "PROCESSED",
        processedAt: new Date(),
        errorMessage: null,
      },
    });
  }

  return {
    delivery: newDelivery,
    result,
  };
}

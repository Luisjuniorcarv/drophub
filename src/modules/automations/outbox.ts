import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { createDomainEvent, DomainEventType, DomainEventEnvelope } from "./events";

export interface PublishEventParams<T = any> {
  type: DomainEventType | string;
  entityType: string;
  entityId: string;
  data: T;
}

/**
 * Publica um evento de domínio na tabela Outbox.
 * Pode ser executado dentro de uma transação Prisma ($transaction) para garantir atomicidade.
 */
export async function publishDomainEvent<T = any>(
  db: Prisma.TransactionClient | typeof prisma = prisma,
  params: PublishEventParams<T>
): Promise<DomainEventEnvelope<T>> {
  const envelope = createDomainEvent(params);

  await db.outboxEvent.create({
    data: {
      id: envelope.id,
      eventType: envelope.type,
      entityType: envelope.entity.type,
      entityId: envelope.entity.id,
      payload: envelope as any,
      status: "PENDING",
      attempts: 0,
      maxAttempts: 3,
      nextAttemptAt: new Date(),
    },
  });

  return envelope;
}

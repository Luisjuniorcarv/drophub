import crypto from "crypto";

/**
 * Tipos Oficiais de Eventos de Domínio do DropHub
 */
export const DOMAIN_EVENTS = {
  // Pedidos
  ORDER_CREATED: "ORDER_CREATED",
  ORDER_PAID: "ORDER_PAID",
  ORDER_PROCESSING: "ORDER_PROCESSING",
  ORDER_AWAITING_SUPPLIER: "ORDER_AWAITING_SUPPLIER",
  ORDER_SENT_TO_SUPPLIER: "ORDER_SENT_TO_SUPPLIER",
  ORDER_SHIPPED: "ORDER_SHIPPED",
  ORDER_DELIVERED: "ORDER_DELIVERED",
  ORDER_CANCELLED: "ORDER_CANCELLED",
  ORDER_REFUNDED: "ORDER_REFUNDED",

  // Catálogo & Estoque
  PRODUCT_CREATED: "PRODUCT_CREATED",
  PRODUCT_UPDATED: "PRODUCT_UPDATED",
  LOW_STOCK: "LOW_STOCK",
  STOCK_RESTOCKED: "STOCK_RESTOCKED",
  STOCK_ADJUSTED: "STOCK_ADJUSTED",
  STOCK_LOW: "STOCK_LOW",
  STOCK_OUT: "STOCK_OUT",
  STOCK_RETURNED: "STOCK_RETURNED",

  // Clientes
  CUSTOMER_CREATED: "CUSTOMER_CREATED",

  // Pagamentos
  PAYMENT_APPROVED: "PAYMENT_APPROVED",
  PAYMENT_FAILED: "PAYMENT_FAILED",

  // Fulfillment / Fornecedores
  FULFILLMENT_CREATED: "FULFILLMENT_CREATED",
  FULFILLMENT_SUBMITTED: "FULFILLMENT_SUBMITTED",
  FULFILLMENT_ACKNOWLEDGED: "FULFILLMENT_ACKNOWLEDGED",
  FULFILLMENT_FAILED: "FULFILLMENT_FAILED",
  FULFILLMENT_SHIPPED: "FULFILLMENT_SHIPPED",
  FULFILLMENT_DELIVERED: "FULFILLMENT_DELIVERED",
  FULFILLMENT_CANCELLED: "FULFILLMENT_CANCELLED",

  // Sistema / Teste
  TEST_PING: "TEST_PING",
} as const;

export type DomainEventType = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

/**
 * Envelope Padrão de Evento de Domínio (LGPD Compliant)
 */
export interface DomainEventEnvelope<T = any> {
  id: string; // UUID v4 único para idempotência
  type: DomainEventType | string;
  occurredAt: string; // ISO 8601
  source: "drophub";
  entity: {
    type: string; // "Order", "Product", "Customer", "Payment"
    id: string;
  };
  data: T;
}

/**
 * Construtor do Envelope Padronizado de Evento
 */
export function createDomainEvent<T = any>(params: {
  id?: string;
  type: DomainEventType | string;
  entityType: string;
  entityId: string;
  data: T;
}): DomainEventEnvelope<T> {
  return {
    id: params.id || crypto.randomUUID(),
    type: params.type,
    occurredAt: new Date().toISOString(),
    source: "drophub",
    entity: {
      type: params.entityType,
      id: params.entityId,
    },
    data: params.data,
  };
}

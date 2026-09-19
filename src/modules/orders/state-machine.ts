import { OrderStatus } from "@prisma/client";

/**
 * Matriz de Transições Válidas da Máquina de Estados de Pedidos
 */
export const VALID_ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  // Aguardando Pagamento pode ir para Pago ou Cancelado
  [OrderStatus.AWAITING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED],

  // Pago pode ir para Processando, Cancelado ou Reembolsado
  [OrderStatus.PAID]: [
    OrderStatus.PROCESSING,
    OrderStatus.AWAITING_SUPPLIER,
    OrderStatus.SENT_TO_SUPPLIER,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],

  // Processando pode ir para Aguardando Fornecedor, Enviado ao Fornecedor, Cancelado ou Reembolsado
  [OrderStatus.PROCESSING]: [
    OrderStatus.AWAITING_SUPPLIER,
    OrderStatus.SENT_TO_SUPPLIER,
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],

  // Aguardando Fornecedor pode ir para Enviado ao Fornecedor ou Cancelado
  [OrderStatus.AWAITING_SUPPLIER]: [
    OrderStatus.SENT_TO_SUPPLIER,
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],

  // Enviado ao Fornecedor pode ir para Enviado (com rastreio) ou Cancelado
  [OrderStatus.SENT_TO_SUPPLIER]: [
    OrderStatus.SHIPPED,
    OrderStatus.CANCELLED,
    OrderStatus.REFUNDED,
  ],

  // Enviado pode ir para Entregue ou Reembolsado (devolução)
  [OrderStatus.SHIPPED]: [
    OrderStatus.DELIVERED,
    OrderStatus.REFUNDED,
  ],

  // Entregue pode ir para Reembolsado (garantia/devolução)
  [OrderStatus.DELIVERED]: [
    OrderStatus.REFUNDED,
  ],

  // Cancelado e Reembolsado são estados terminais
  [OrderStatus.CANCELLED]: [],
  [OrderStatus.REFUNDED]: [],
};

/**
 * Verifica se a transição entre dois status de pedido é válida
 */
export function isValidStatusTransition(
  currentStatus: OrderStatus,
  newStatus: OrderStatus
): boolean {
  if (currentStatus === newStatus) return true; // Sem alteração é aceito
  const allowed = VALID_ORDER_TRANSITIONS[currentStatus] || [];
  return allowed.includes(newStatus);
}

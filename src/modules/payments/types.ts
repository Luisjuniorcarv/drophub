import { PaymentMethod, PaymentStatus } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const PAYMENT_GATEWAYS = {
  MERCADO_PAGO: "MERCADO_PAGO",
  TEST_GATEWAY: "TEST_GATEWAY",
} as const;

export type PaymentGatewayName = (typeof PAYMENT_GATEWAYS)[keyof typeof PAYMENT_GATEWAYS] | string;

export interface PayerInfo {
  name: string;
  email: string;
  cpf?: string;
  phone?: string;
}

export interface CreatePaymentInput {
  orderId: string;
  orderNumber: string;
  amount: number | Decimal;
  method: PaymentMethod;
  payer: PayerInfo;
  description?: string;
  idempotencyKey?: string;
  // Dados específicos para Cartão de Crédito (Tokenizado)
  cardToken?: string;
  installments?: number;
  paymentMethodId?: string; // ex: "visa", "master", "elo"
  issuerId?: string;
}

export interface CreatePaymentOutput {
  success: boolean;
  gateway: string;
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  // Campos específicos de Pix
  qrCode?: string | null;
  qrCodeBase64?: string | null;
  ticketUrl?: string | null;
  expiresAt?: Date | null;
  // Tratamento de falha segura
  failureReason?: string | null;
  errorMessage?: string | null;
  rawResponse?: any;
}

export interface GetPaymentOutput {
  transactionId: string;
  status: PaymentStatus;
  amount: number;
  paidAt?: Date | null;
  failedAt?: Date | null;
  cancelledAt?: Date | null;
  refundedAt?: Date | null;
  failureReason?: string | null;
  rawResponse?: any;
}

export interface CancelPaymentOutput {
  success: boolean;
  status: PaymentStatus;
  errorMessage?: string | null;
  rawResponse?: any;
}

export interface RefundPaymentOutput {
  success: boolean;
  status: PaymentStatus;
  refundId?: string;
  amountRefunded: number;
  errorMessage?: string | null;
  rawResponse?: any;
}

export interface ParsedWebhookEvent {
  isValid: boolean;
  eventType: string; // ex: "payment.updated", "payment.created"
  transactionId: string;
  status?: PaymentStatus;
  rawPayload: any;
}

/**
 * Interface Universal de Gateway de Pagamento (DIP - Dependency Inversion Principle)
 */
export interface PaymentGateway {
  readonly name: string;

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput>;

  getPayment(transactionId: string): Promise<GetPaymentOutput>;

  cancelPayment(transactionId: string): Promise<CancelPaymentOutput>;

  refundPayment(transactionId: string, amount?: number): Promise<RefundPaymentOutput>;

  parseWebhook(payload: any, headers?: Record<string, string>): Promise<ParsedWebhookEvent>;

  verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean>;
}

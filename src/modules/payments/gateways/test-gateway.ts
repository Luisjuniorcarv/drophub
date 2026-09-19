import {
  PaymentGateway,
  CreatePaymentInput,
  CreatePaymentOutput,
  GetPaymentOutput,
  CancelPaymentOutput,
  RefundPaymentOutput,
  ParsedWebhookEvent,
  PAYMENT_GATEWAYS,
} from "../types";
import { PaymentStatus, PaymentMethod } from "@prisma/client";
import crypto from "crypto";

export class TestGateway implements PaymentGateway {
  readonly name = PAYMENT_GATEWAYS.TEST_GATEWAY;

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const numAmount = Number(input.amount);
    const transactionId = `tx_test_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;

    // Simulação para Pix
    if (input.method === PaymentMethod.PIX) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
      const qrCode = `00020126580014BR.GOV.BCB.PIX0136test-drophub-pix-${input.orderNumber}520400005303986540${numAmount.toFixed(2)}5802BR5915DropHub Commer6009Sao Paulo62070503***6304`;
      const qrCodeBase64 = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="#fff"/><text x="20" y="100" fill="#000" font-size="12">Pix DH-${input.orderNumber}</text></svg>`
      ).toString("base64");

      return {
        success: true,
        gateway: this.name,
        transactionId,
        status: PaymentStatus.PENDING,
        amount: numAmount,
        qrCode,
        qrCodeBase64,
        expiresAt,
        rawResponse: { simulated: true, method: "pix", transactionId },
      };
    }

    // Simulação para Cartão de Crédito
    if (input.method === PaymentMethod.CREDIT_CARD) {
      // Se o token de teste simular falha
      if (input.cardToken === "tok_fail" || input.cardToken === "tok_rejected") {
        return {
          success: false,
          gateway: this.name,
          transactionId,
          status: PaymentStatus.FAILED,
          amount: numAmount,
          failureReason: "cc_rejected_insufficient_amount (Cartão recusado pelo emissor)",
          errorMessage: "Pagamento não autorizado pela operadora de cartão.",
          rawResponse: { simulated: true, status: "rejected", reason: "insufficient_amount" },
        };
      }

      // Aprovação imediata de teste
      return {
        success: true,
        gateway: this.name,
        transactionId,
        status: PaymentStatus.APPROVED,
        amount: numAmount,
        rawResponse: {
          simulated: true,
          status: "approved",
          cardLast4: "1234",
          installments: input.installments || 1,
        },
      };
    }

    // Default / TEST_MODE
    return {
      success: true,
      gateway: this.name,
      transactionId,
      status: PaymentStatus.APPROVED,
      amount: numAmount,
      rawResponse: { simulated: true, method: "test_mode" },
    };
  }

  async getPayment(transactionId: string): Promise<GetPaymentOutput> {
    return {
      transactionId,
      status: PaymentStatus.APPROVED,
      amount: 100.0,
      paidAt: new Date(),
      rawResponse: { simulated: true, transactionId, status: "approved" },
    };
  }

  async cancelPayment(transactionId: string): Promise<CancelPaymentOutput> {
    return {
      success: true,
      status: PaymentStatus.CANCELLED,
      rawResponse: { simulated: true, transactionId, status: "cancelled" },
    };
  }

  async refundPayment(transactionId: string, amount?: number): Promise<RefundPaymentOutput> {
    return {
      success: true,
      status: PaymentStatus.REFUNDED,
      refundId: `ref_test_${Date.now()}`,
      amountRefunded: amount || 0,
      rawResponse: { simulated: true, transactionId, status: "refunded" },
    };
  }

  async parseWebhook(payload: any): Promise<ParsedWebhookEvent> {
    const action = payload.action || payload.type || payload.event || "payment.updated";
    const transactionId =
      payload.data?.id || payload.id || payload.transactionId || `tx_test_${Date.now()}`;
    const statusStr = payload.data?.status || payload.status || "approved";

    let status: PaymentStatus = PaymentStatus.PENDING;
    if (statusStr === "approved") status = PaymentStatus.APPROVED;
    if (statusStr === "rejected" || statusStr === "failed") status = PaymentStatus.FAILED;
    if (statusStr === "refunded") status = PaymentStatus.REFUNDED;
    if (statusStr === "cancelled") status = PaymentStatus.CANCELLED;

    return {
      isValid: true,
      eventType: action,
      transactionId: String(transactionId),
      status,
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(headers?: Record<string, string>, rawBody?: string): Promise<boolean> {
    // TestGateway sempre valida com sucesso em ambiente de teste
    return true;
  }
}

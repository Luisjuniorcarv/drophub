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

export class MercadoPagoGateway implements PaymentGateway {
  readonly name = PAYMENT_GATEWAYS.MERCADO_PAGO;

  private get accessToken(): string {
    return (
      process.env.MERCADO_PAGO_ACCESS_TOKEN ||
      process.env.MERCADOPAGO_ACCESS_TOKEN ||
      ""
    );
  }

  private get webhookSecret(): string {
    return (
      process.env.MERCADO_PAGO_WEBHOOK_SECRET ||
      process.env.MERCADOPAGO_WEBHOOK_SECRET ||
      ""
    );
  }

  private get baseUrl(): string {
    return (
      process.env.MERCADO_PAGO_BASE_URL ||
      process.env.MERCADOPAGO_BASE_URL ||
      "https://api.mercadopago.com"
    );
  }

  private mapMercadoPagoStatus(mpStatus: string): PaymentStatus {
    switch (mpStatus?.toLowerCase()) {
      case "approved":
        return PaymentStatus.APPROVED;
      case "rejected":
        return PaymentStatus.FAILED;
      case "cancelled":
        return PaymentStatus.CANCELLED;
      case "refunded":
      case "charged_back":
        return PaymentStatus.REFUNDED;
      case "pending":
      case "in_process":
      case "in_mediation":
      case "authorized":
      default:
        return PaymentStatus.PENDING;
    }
  }

  async createPayment(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    if (!this.accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não está configurado nas variáveis de ambiente.");
    }

    const numAmount = Number(Number(input.amount).toFixed(2));
    const cleanCpf = input.payer.cpf?.replace(/\D/g, "");

    const payload: any = {
      transaction_amount: numAmount,
      description: input.description || `DropHub Pedido DH-${input.orderNumber}`,
      external_reference: input.orderId,
      payer: {
        email: input.payer.email,
        first_name: input.payer.name.split(" ")[0],
        last_name: input.payer.name.split(" ").slice(1).join(" ") || undefined,
        ...(cleanCpf ? { identification: { type: "CPF", number: cleanCpf } } : {}),
      },
      notification_url: process.env.MERCADOPAGO_NOTIFICATION_URL || undefined,
    };

    if (input.method === PaymentMethod.PIX) {
      payload.payment_method_id = "pix";
    } else if (input.method === PaymentMethod.CREDIT_CARD) {
      if (!input.cardToken) {
        throw new Error("Token de cartão de crédito não fornecido.");
      }
      payload.token = input.cardToken;
      payload.installments = input.installments || 1;
      if (input.paymentMethodId) payload.payment_method_id = input.paymentMethodId;
      if (input.issuerId) payload.issuer_id = input.issuerId;
    }

    const headers: Record<string, string> = {
      Authorization: `Bearer ${this.accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": input.idempotencyKey || `drophub_${input.orderId}_${Date.now()}`,
    };

    const res = await fetch(`${this.baseUrl}/v1/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      const errorMsg =
        data.message || data.cause?.[0]?.description || `Erro HTTP ${res.status} no Mercado Pago`;
      return {
        success: false,
        gateway: this.name,
        transactionId: data.id ? String(data.id) : "",
        status: PaymentStatus.FAILED,
        amount: numAmount,
        failureReason: errorMsg,
        errorMessage: errorMsg,
        rawResponse: data,
      };
    }

    const status = this.mapMercadoPagoStatus(data.status);
    const pixData = data.point_of_interaction?.transaction_data;

    return {
      success: status === PaymentStatus.APPROVED || status === PaymentStatus.PENDING,
      gateway: this.name,
      transactionId: String(data.id),
      status,
      amount: numAmount,
      qrCode: pixData?.qr_code || null,
      qrCodeBase64: pixData?.qr_code_base64 || null,
      ticketUrl: pixData?.ticket_url || null,
      expiresAt: data.date_of_expiration ? new Date(data.date_of_expiration) : null,
      failureReason: status === PaymentStatus.FAILED ? data.status_detail : null,
      rawResponse: data,
    };
  }

  async getPayment(transactionId: string): Promise<GetPaymentOutput> {
    if (!this.accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não está configurado.");
    }

    const res = await fetch(`${this.baseUrl}/v1/payments/${transactionId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
      },
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(
        `Erro ao consultar transação no Mercado Pago: ${data.message || res.statusText}`
      );
    }

    const status = this.mapMercadoPagoStatus(data.status);

    return {
      transactionId: String(data.id),
      status,
      amount: Number(data.transaction_amount),
      paidAt: data.date_approved ? new Date(data.date_approved) : null,
      failureReason: status === PaymentStatus.FAILED ? data.status_detail : null,
      rawResponse: data,
    };
  }

  async cancelPayment(transactionId: string): Promise<CancelPaymentOutput> {
    if (!this.accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não está configurado.");
    }

    const res = await fetch(`${this.baseUrl}/v1/payments/${transactionId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ status: "cancelled" }),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: PaymentStatus.PENDING,
        errorMessage: data.message || `Erro ao cancelar pagamento (${res.status})`,
        rawResponse: data,
      };
    }

    return {
      success: true,
      status: this.mapMercadoPagoStatus(data.status),
      rawResponse: data,
    };
  }

  async refundPayment(transactionId: string, amount?: number): Promise<RefundPaymentOutput> {
    if (!this.accessToken) {
      throw new Error("MERCADOPAGO_ACCESS_TOKEN não está configurado.");
    }

    const payload = amount ? { amount: Number(amount.toFixed(2)) } : {};

    const res = await fetch(`${this.baseUrl}/v1/payments/${transactionId}/refunds`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      return {
        success: false,
        status: PaymentStatus.APPROVED,
        amountRefunded: 0,
        errorMessage: data.message || `Erro ao reembolsar pagamento (${res.status})`,
        rawResponse: data,
      };
    }

    return {
      success: true,
      status: PaymentStatus.REFUNDED,
      refundId: String(data.id),
      amountRefunded: Number(data.amount || amount || 0),
      rawResponse: data,
    };
  }

  async parseWebhook(payload: any): Promise<ParsedWebhookEvent> {
    const action = payload.action || payload.type || "";
    const transactionId =
      payload.data?.id || payload.id || payload.resource?.split("/").pop() || "";

    return {
      isValid: Boolean(transactionId),
      eventType: action,
      transactionId: String(transactionId),
      rawPayload: payload,
    };
  }

  async verifyWebhookSignature(headers: Record<string, string>, rawBody: string): Promise<boolean> {
    const secret = this.webhookSecret;
    // Se nenhum segredo foi configurado no ambiente, consideramos desabilitada a checagem em dev
    if (!secret) return true;

    const signatureHeader = headers["x-signature"] || headers["X-Signature"];
    const requestId = headers["x-request-id"] || headers["X-Request-Id"];

    if (!signatureHeader) return false;

    try {
      // Formato Mercado Pago: ts=1700000000,v1=hashhex
      const parts = signatureHeader.split(",");
      let ts = "";
      let hash = "";

      for (const part of parts) {
        const [k, v] = part.trim().split("=");
        if (k === "ts") ts = v;
        if (k === "v1") hash = v;
      }

      if (!ts || !hash) return false;

      // Verificar manifest
      let manifest = "";
      try {
        const parsed = JSON.parse(rawBody);
        const dataId = parsed.data?.id || parsed.id || "";
        manifest = `id:${dataId};request-id:${requestId || ""};ts:${ts};`;
      } catch {
        manifest = `request-id:${requestId || ""};ts:${ts};`;
      }

      const calculatedHash = crypto.createHmac("sha256", secret).update(manifest).digest("hex");

      const hashBuf = Buffer.from(hash);
      const calcBuf = Buffer.from(calculatedHash);

      if (hashBuf.length === calcBuf.length && crypto.timingSafeEqual(hashBuf, calcBuf)) {
        return true;
      }

      // Fallback: cálculo direto sobre rawBody
      const directHash = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
      const directBuf = Buffer.from(directHash);
      return hashBuf.length === directBuf.length && crypto.timingSafeEqual(hashBuf, directBuf);
    } catch {
      return false;
    }
  }
}

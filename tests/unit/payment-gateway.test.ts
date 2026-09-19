import { describe, it, expect } from "vitest";
import { TestGateway } from "../../src/modules/payments/gateways/test-gateway";
import { MercadoPagoGateway } from "../../src/modules/payments/gateways/mercadopago";
import { getPaymentGateway } from "../../src/modules/payments/gateway-factory";
import { PAYMENT_GATEWAYS } from "../../src/modules/payments/types";
import {
  CreatePaymentSchema,
  CancelPaymentSchema,
  RefundPaymentSchema,
} from "../../src/lib/validators";
import crypto from "crypto";

describe("Payment Gateway & Adapters Unit Tests", () => {
  describe("Gateway Factory", () => {
    it("should instantiate TestGateway when requested or in test mode", () => {
      const gw = getPaymentGateway("TEST");
      expect(gw.name).toBe(PAYMENT_GATEWAYS.TEST_GATEWAY);
      expect(gw).toBeInstanceOf(TestGateway);
    });

    it("should instantiate MercadoPagoGateway when requested", () => {
      const gw = getPaymentGateway("MERCADO_PAGO");
      expect(gw.name).toBe(PAYMENT_GATEWAYS.MERCADO_PAGO);
      expect(gw).toBeInstanceOf(MercadoPagoGateway);
    });
  });

  describe("TestGateway Adapter", () => {
    const gateway = new TestGateway();

    it("should create a mock Pix payment with QR code and transaction ID", async () => {
      const result = await gateway.createPayment({
        orderId: "ord-test-1",
        orderNumber: "DH-9999",
        amount: 149.9,
        method: "PIX",
        payer: {
          name: "João Silva",
          email: "joao@example.com",
          cpf: "12345678901",
        },
        idempotencyKey: "test-idem-key-1",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("PENDING");
      expect(result.transactionId).toMatch(/^tx_test_/);
      expect(result.qrCode).toContain("00020126580014BR.GOV.BCB.PIX");
      expect(result.qrCodeBase64).toBeDefined();
    });

    it("should create a mock Credit Card payment and approve immediately in test mode", async () => {
      const result = await gateway.createPayment({
        orderId: "ord-test-2",
        orderNumber: "DH-9998",
        amount: 250.0,
        method: "CREDIT_CARD",
        payer: {
          name: "Maria Souza",
          email: "maria@example.com",
          cpf: "98765432100",
        },
        cardToken: "tok_mock_valid_card",
        installments: 3,
        idempotencyKey: "test-idem-key-2",
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe("APPROVED");
      expect(result.transactionId).toBeDefined();
    });

    it("should allow querying payment status", async () => {
      const status = await gateway.getPayment("tx_test_12345");
      expect(status.status).toBe("APPROVED");
      expect(status.amount).toBe(100.0);
    });

    it("should allow cancelling a pending test payment", async () => {
      const cancelRes = await gateway.cancelPayment("tx_test_12345");
      expect(cancelRes.success).toBe(true);
      expect(cancelRes.status).toBe("CANCELLED");
    });

    it("should allow refunding an approved test payment", async () => {
      const refundRes = await gateway.refundPayment("tx_test_12345", 149.9);
      expect(refundRes.success).toBe(true);
      expect(refundRes.status).toBe("REFUNDED");
      expect(refundRes.refundId).toMatch(/^ref_test_/);
    });

    it("should verify webhook signature always true for test gateway", async () => {
      const isValid = await gateway.verifyWebhookSignature({ any: "body" }, "sig");
      expect(isValid).toBe(true);
    });

    it("should parse webhook payload", async () => {
      const parsed = await gateway.parseWebhook({
        event: "PAYMENT_APPROVED",
        transactionId: "tx_test_999",
      });
      expect(parsed.eventType).toBe("PAYMENT_APPROVED");
      expect(parsed.transactionId).toBe("tx_test_999");
    });
  });

  describe("MercadoPagoGateway Signature & Payload Parsing", () => {
    const mpSecret = "test_mp_webhook_secret_key";
    process.env.MERCADOPAGO_WEBHOOK_SECRET = mpSecret;
    const gateway = new MercadoPagoGateway();

    it("should verify valid Mercado Pago HMAC-SHA256 signature", async () => {
      const dataId = "123456789";
      const ts = Math.floor(Date.now() / 1000).toString();
      const manifest = `id:${dataId};request-id:req-abc-123;ts:${ts};`;
      const hash = crypto.createHmac("sha256", mpSecret).update(manifest).digest("hex");
      const signatureHeader = `ts=${ts},v1=${hash}`;

      const rawBody = JSON.stringify({ data: { id: dataId } });
      const isValid = await gateway.verifyWebhookSignature(
        {
          "x-signature": signatureHeader,
          "x-request-id": "req-abc-123",
        },
        rawBody
      );

      expect(isValid).toBe(true);
    });

    it("should reject tampered or invalid signature", async () => {
      const dataId = "123456789";
      const ts = Math.floor(Date.now() / 1000).toString();
      const signatureHeader = `ts=${ts},v1=wrong_invalid_hash_signature_00000000000000`;

      const rawBody = JSON.stringify({ data: { id: dataId } });
      const isValid = await gateway.verifyWebhookSignature(
        {
          "x-signature": signatureHeader,
          "x-request-id": "req-abc-123",
        },
        rawBody
      );

      expect(isValid).toBe(false);
    });

    it("should parse Mercado Pago webhook payload and query parameters", async () => {
      const payload1 = {
        action: "payment.updated",
        data: { id: "9876543210" },
      };
      const parsed1 = await gateway.parseWebhook(payload1);
      expect(parsed1.eventType).toBe("payment.updated");
      expect(parsed1.transactionId).toBe("9876543210");

      const parsed2 = await gateway.parseWebhook({
        type: "payment",
        data: { id: "11223344" },
      });
      expect(parsed2.eventType).toBe("payment");
      expect(parsed2.transactionId).toBe("11223344");
    });
  });

  describe("Payment Validation Schemas", () => {
    it("should validate PIX checkout request", () => {
      const validPix = {
        orderId: "clx0000000000000000000001",
        method: "PIX",
      };
      const result = CreatePaymentSchema.safeParse(validPix);
      expect(result.success).toBe(true);
    });

    it("should allow cardToken for CREDIT_CARD method", () => {
      const cardWithToken = {
        orderId: "clx0000000000000000000001",
        method: "CREDIT_CARD",
        cardToken: "tok_visa_4111_valid",
        installments: 1,
      };
      const resWithToken = CreatePaymentSchema.safeParse(cardWithToken);
      expect(resWithToken.success).toBe(true);
    });

    it("should reject invalid payment methods", () => {
      const invalid = {
        orderId: "clx0000000000000000000001",
        method: "BITCOIN",
      };
      const res = CreatePaymentSchema.safeParse(invalid);
      expect(res.success).toBe(false);
    });

    it("should validate cancel and refund schema payloads", () => {
      const cancelRes = CancelPaymentSchema.safeParse({ reason: "Cliente desistiu antes de pagar" });
      expect(cancelRes.success).toBe(true);

      const refundRes = RefundPaymentSchema.safeParse({ reason: "Devolução solicitada" });
      expect(refundRes.success).toBe(true);
    });
  });
});

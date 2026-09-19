import { SupplierAdapter } from "./supplier-adapter";
import {
  SupplierCreateOrderInput,
  SupplierCreateOrderOutput,
  SupplierGetStatusInput,
  SupplierOrderStatusOutput,
  SupplierCancelOrderInput,
  SupplierCancelOrderOutput,
} from "../types";
import { FulfillmentStatus } from "@prisma/client";

/**
 * Adaptador de Teste / Mock determinístico para Fornecedores
 * Permite simular todo o fluxo operacional sem depender de nenhuma API externa.
 */
export class TestSupplierAdapter implements SupplierAdapter {
  readonly name = "TEST_SUPPLIER";
  readonly provider = "TEST";
  readonly rateLimit = { requests: 100, windowMs: 60000 };

  private shouldFail = false;
  private failureErrorMessage = "Erro simulado na API do Fornecedor (HTTP 500)";
  private simulatedStatus: FulfillmentStatus = FulfillmentStatus.ACKNOWLEDGED;
  private customTrackingNumber = "BR123456789DH";
  private customCarrier = "Correios";

  constructor(options?: {
    shouldFail?: boolean;
    failureErrorMessage?: string;
    simulatedStatus?: FulfillmentStatus;
  }) {
    if (options?.shouldFail !== undefined) this.shouldFail = options.shouldFail;
    if (options?.failureErrorMessage) this.failureErrorMessage = options.failureErrorMessage;
    if (options?.simulatedStatus) this.simulatedStatus = options.simulatedStatus;
  }

  async testConnection(
    credentials?: Record<string, any> | null,
    config?: Record<string, any> | null
  ) {
    await new Promise((r) => setTimeout(r, 20));

    if (this.shouldFail) {
      return {
        success: false,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
      };
    }

    if (credentials?.invalid || credentials?.apiKey === "invalid_key") {
      return {
        success: false,
        status: "FAILED",
        errorMessage: "Credenciais de API rejeitadas pelo fornecedor (401 Unauthorized)",
      };
    }

    return {
      success: true,
      status: "CONNECTED",
      message: "Conexão com o fornecedor estabelecida com sucesso.",
    };
  }

  setShouldFail(shouldFail: boolean, errorMessage?: string) {
    this.shouldFail = shouldFail;
    if (errorMessage) this.failureErrorMessage = errorMessage;
  }

  setSimulatedStatus(status: FulfillmentStatus) {
    this.simulatedStatus = status;
  }

  setCustomTracking(trackingNumber: string, carrier: string) {
    this.customTrackingNumber = trackingNumber;
    this.customCarrier = carrier;
  }

  reset() {
    this.shouldFail = false;
    this.failureErrorMessage = "Erro simulado na API do Fornecedor (HTTP 500)";
    this.simulatedStatus = FulfillmentStatus.ACKNOWLEDGED;
    this.customTrackingNumber = "BR123456789DH";
    this.customCarrier = "Correios";
  }

  async createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderOutput> {
    // Simulação de latência de rede realista (mínima para testes rápidos)
    await new Promise((r) => setTimeout(r, 20));

    if (this.shouldFail) {
      return {
        success: false,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
        rawResponse: {
          error: "API_UNAVAILABLE",
          code: 500,
          timestamp: new Date().toISOString(),
        },
      };
    }

    const uniqueSuffix = Math.floor(100000 + Math.random() * 900000);
    const externalOrderId = `EXT-${input.orderNumber}-${uniqueSuffix}`;
    const supplierOrderNumber = `SUP-${uniqueSuffix}`;

    return {
      success: true,
      status: "ACKNOWLEDGED",
      externalOrderId,
      supplierOrderNumber,
      rawResponse: {
        received: true,
        externalOrderId,
        supplierOrderNumber,
        itemsCount: input.items.length,
        recipientCity: input.recipient.city,
        timestamp: new Date().toISOString(),
      },
    };
  }

  async getOrderStatus(input: SupplierGetStatusInput): Promise<SupplierOrderStatusOutput> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        status: FulfillmentStatus.FAILED,
        errorMessage: this.failureErrorMessage,
      };
    }

    const isShipped =
      this.simulatedStatus === FulfillmentStatus.SHIPPED ||
      this.simulatedStatus === FulfillmentStatus.DELIVERED;

    return {
      success: true,
      status: this.simulatedStatus,
      trackingNumber: isShipped ? this.customTrackingNumber : undefined,
      carrier: isShipped ? this.customCarrier : undefined,
      trackingUrl: isShipped
        ? `https://rastreamento.correios.com.br/app/index.php?codigo=${this.customTrackingNumber}`
        : undefined,
      shippedAt: isShipped ? new Date() : undefined,
      deliveredAt: this.simulatedStatus === FulfillmentStatus.DELIVERED ? new Date() : undefined,
      rawResponse: {
        externalOrderId: input.externalOrderId,
        status: this.simulatedStatus,
        lastUpdate: new Date().toISOString(),
      },
    };
  }

  async cancelOrder(input: SupplierCancelOrderInput): Promise<SupplierCancelOrderOutput> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        cancelled: false,
        errorMessage: this.failureErrorMessage,
      };
    }

    return {
      success: true,
      cancelled: true,
      rawResponse: {
        externalOrderId: input.externalOrderId,
        cancelled: true,
        reason: input.reason,
        timestamp: new Date().toISOString(),
      },
    };
  }
}

import { SupplierAdapter } from "./supplier-adapter";
import {
  SupplierProductItem,
  GetSupplierProductsInput,
  GetSupplierProductsResult,
  GetSupplierStockInput,
  GetSupplierStockResult,
  GetSupplierPriceInput,
  GetSupplierPriceResult,
  SupplierCreateOrderInput,
  SupplierCreateOrderOutput,
  GetSupplierOrderInput,
  GetSupplierOrderResult,
  SupplierGetStatusInput,
  SupplierOrderStatusOutput,
  GetSupplierTrackingInput,
  GetSupplierTrackingResult,
  SupplierCancelOrderInput,
  SupplierCancelOrderOutput,
  TestConnectionResult,
  SupplierCapability,
  ALL_SUPPLIER_CAPABILITIES,
} from "../types";
import { FulfillmentStatus } from "@prisma/client";

/**
 * Adaptador de Teste / Mock Determinístico para Fornecedores (Etapa 12/16/17)
 * Claramente identificado como MOCK/TEST para testes de integração e unitários.
 */
export class TestSupplierAdapter implements SupplierAdapter {
  readonly name = "TEST_SUPPLIER";
  readonly provider = "TEST";
  readonly isMock = true;
  readonly rateLimit = { requests: 100, windowMs: 60000 };

  private _capabilities: Set<SupplierCapability> = new Set(ALL_SUPPLIER_CAPABILITIES);

  get capabilities(): ReadonlySet<SupplierCapability> {
    return this._capabilities;
  }

  hasCapability(capability: SupplierCapability): boolean {
    return this._capabilities.has(capability);
  }

  setSupportedCapabilities(capabilities: SupplierCapability[]) {
    this._capabilities = new Set(capabilities);
  }

  private shouldFail = false;
  private failureErrorMessage = "Erro simulado na API do Fornecedor (HTTP 500)";
  private simulatedStatus: FulfillmentStatus = FulfillmentStatus.ACKNOWLEDGED;
  private customTrackingNumber = "BR123456789DH";
  private customCarrier = "Correios";
  private delayMs = 10;
  private simulateTimeout = false;
  private simulateInvalidPayload = false;
  private failUntilAttempts = 0;
  private currentAttemptCount = 0;

  constructor(options?: {
    shouldFail?: boolean;
    failureErrorMessage?: string;
    simulatedStatus?: FulfillmentStatus;
    delayMs?: number;
    capabilities?: SupplierCapability[];
  }) {
    if (options?.shouldFail !== undefined) this.shouldFail = options.shouldFail;
    if (options?.failureErrorMessage) this.failureErrorMessage = options.failureErrorMessage;
    if (options?.simulatedStatus) this.simulatedStatus = options.simulatedStatus;
    if (options?.delayMs !== undefined) this.delayMs = options.delayMs;
    if (options?.capabilities) this._capabilities = new Set(options.capabilities);
  }

  reset() {
    this.shouldFail = false;
    this.failureErrorMessage = "Erro simulado na API do Fornecedor (HTTP 500)";
    this.simulatedStatus = FulfillmentStatus.ACKNOWLEDGED;
    this.customTrackingNumber = "BR123456789DH";
    this.customCarrier = "Correios";
    this.delayMs = 10;
    this.simulateTimeout = false;
    this.simulateInvalidPayload = false;
    this.failUntilAttempts = 0;
    this.currentAttemptCount = 0;
    this._capabilities = new Set(ALL_SUPPLIER_CAPABILITIES);
  }

  async testConnection(
    credentials?: Record<string, any> | null,
    config?: Record<string, any> | null
  ): Promise<TestConnectionResult> {
    await new Promise((r) => setTimeout(r, 20));

    if (this.shouldFail) {
      return {
        success: false,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
        category: "PROVIDER_UNAVAILABLE",
        rawResponse: { error: this.failureErrorMessage, code: 500, timestamp: new Date().toISOString() },
      };
    }

    if (credentials?.invalid || credentials?.apiKey === "invalid_key") {
      return {
        success: false,
        status: "FAILED",
        errorMessage: "Credenciais de API rejeitadas pelo fornecedor (401 Unauthorized)",
        category: "INVALID_CREDENTIALS",
        rawResponse: { error: "UNAUTHORIZED", code: 401, timestamp: new Date().toISOString() },
      };
    }

    return {
      success: true,
      status: "CONNECTED",
      message: "Conexão com o fornecedor estabelecida com sucesso. Latência de rede: 20ms.",
      rawResponse: {
        connected: true,
        provider: "TEST",
        pingMs: 20,
        timestamp: new Date().toISOString(),
      },
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

  setSimulateTimeout(timeout: boolean) {
    this.simulateTimeout = timeout;
  }

  setSimulateInvalidPayload(invalid: boolean) {
    this.simulateInvalidPayload = invalid;
  }

  setFailUntilAttempts(attempts: number, errorMessage?: string) {
    this.failUntilAttempts = attempts;
    this.currentAttemptCount = 0;
    if (errorMessage) this.failureErrorMessage = errorMessage;
  }

  getAttemptCount(): number {
    return this.currentAttemptCount;
  }

  private async checkSimulationAndDelay(): Promise<void> {
    this.currentAttemptCount++;

    if (this.simulateTimeout) {
      await new Promise((r) => setTimeout(r, 600));
      throw new Error("SUPPLIER_TIMEOUT: Conexão com o fornecedor expirou.");
    }

    if (this.delayMs > 0) {
      await new Promise((r) => setTimeout(r, this.delayMs));
    }

    if (this.failUntilAttempts > 0 && this.currentAttemptCount <= this.failUntilAttempts) {
      throw new Error(`SUPPLIER_TRANSIENT_ERROR: ${this.failureErrorMessage} (Tentativa ${this.currentAttemptCount})`);
    }

    if (this.shouldFail) {
      throw new Error(`SUPPLIER_API_ERROR: ${this.failureErrorMessage}`);
    }
  }

  async getProducts(input?: GetSupplierProductsInput): Promise<GetSupplierProductsResult> {
    if (!this.hasCapability("PRODUCTS")) {
      return {
        success: false,
        products: [],
        total: 0,
        page: 1,
        hasMore: false,
        errorMessage: "Operação 'PRODUCTS' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

      if (this.simulateInvalidPayload) {
        return {
          success: false,
          products: null as any,
          total: -1,
          page: 1,
          hasMore: false,
          errorMessage: "Payload corrompido retornado pelo fornecedor",
          rawResponse: "INVALID_JSON_STREAM",
        };
      }

      const mockProducts: SupplierProductItem[] = [
        {
          externalId: "SUP-PROD-001",
          sku: "SKU-SHIRT-BLK-M",
          name: "Camiseta Algodão Egípcio - Preto / M",
          description: "Camiseta premium 100% algodão egípcio fio 30.1 penteado",
          costPrice: 28.5,
          suggestedPrice: 79.9,
          stock: 150,
          category: "Vestuário",
          attributes: { cor: "Preto", tamanho: "M" },
          images: ["https://images.unsplash.com/photo-1521572267360-ee0c2909d518"],
        },
        {
          externalId: "SUP-PROD-002",
          sku: "SKU-MUG-CERAMIC",
          name: "Caneca Cerâmica Fosca 350ml",
          description: "Caneca minimalista com acabamento em cerâmica fosca",
          costPrice: 12.0,
          suggestedPrice: 39.9,
          stock: 80,
          category: "Casa & Cozinha",
          attributes: { material: "Cerâmica", capacidade: "350ml" },
          images: ["https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd"],
        },
        {
          externalId: "SUP-PROD-003",
          sku: "SKU-BACKPACK-WATERPROOF",
          name: "Mochila Executiva Impermeável",
          description: "Mochila para notebook até 15.6 polegadas com tecido resistente a água",
          costPrice: 45.0,
          suggestedPrice: 139.9,
          stock: 45,
          category: "Acessórios",
          attributes: { cor: "Cinza", capacidade: "25L" },
          images: ["https://images.unsplash.com/photo-1553062407-98eeb64c6a62"],
        },
      ];

      return {
        success: true,
        products: mockProducts,
        total: mockProducts.length,
        page: input?.page || 1,
        hasMore: false,
        rawResponse: { count: mockProducts.length, timestamp: new Date().toISOString() },
      };
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        products: [],
        total: 0,
        page: 1,
        hasMore: false,
        errorMessage: err.message,
      };
    }
  }

  async getStock(input: GetSupplierStockInput): Promise<GetSupplierStockResult> {
    if (!this.hasCapability("STOCK")) {
      return {
        success: false,
        items: [],
        errorMessage: "Operação 'STOCK' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

      const items = input.skus.map((sku) => {
        const isOutOfStock = sku.toUpperCase().includes("OUT") || sku.toUpperCase().includes("ZERO");
        const stock = isOutOfStock ? 0 : 75;
        return {
          sku,
          stock,
          isAvailable: stock > 0,
        };
      });

      return {
        success: true,
        items,
        rawResponse: { requestedSkus: input.skus, timestamp: new Date().toISOString() },
      };
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        items: [],
        errorMessage: err.message,
      };
    }
  }

  async getPrice(input: GetSupplierPriceInput): Promise<GetSupplierPriceResult> {
    if (!this.hasCapability("PRICE")) {
      return {
        success: false,
        items: [],
        errorMessage: "Operação 'PRICE' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

      const items = input.skus.map((sku) => ({
        sku,
        costPrice: 29.9,
        currency: "BRL",
      }));

      return {
        success: true,
        items,
        rawResponse: { requestedSkus: input.skus, timestamp: new Date().toISOString() },
      };
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        items: [],
        errorMessage: err.message,
      };
    }
  }

  async createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderOutput> {
    if (!this.hasCapability("ORDER_CREATE")) {
      return {
        success: false,
        status: "FAILED",
        errorMessage: "Operação 'ORDER_CREATE' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

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
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        status: "FAILED",
        errorMessage: err.message,
        rawResponse: { error: err.message, timestamp: new Date().toISOString() },
      };
    }
  }

  async getOrder(input: GetSupplierOrderInput): Promise<GetSupplierOrderResult> {
    if (!this.hasCapability("ORDER_READ")) {
      return {
        success: false,
        externalOrderId: input.externalOrderId,
        status: FulfillmentStatus.FAILED,
        items: [],
        totalCost: 0,
        errorMessage: "Operação 'ORDER_READ' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

      const isShipped =
        this.simulatedStatus === FulfillmentStatus.SHIPPED ||
        this.simulatedStatus === FulfillmentStatus.DELIVERED;

      return {
        success: true,
        externalOrderId: input.externalOrderId,
        supplierOrderNumber: input.supplierOrderNumber || "SUP-889900",
        status: this.simulatedStatus,
        items: [
          { sku: "SKU-SHIRT-BLK-M", quantity: 2, unitCost: 28.5 },
        ],
        totalCost: 57.0,
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
          timestamp: new Date().toISOString(),
        },
      };
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        externalOrderId: input.externalOrderId,
        status: FulfillmentStatus.FAILED,
        items: [],
        totalCost: 0,
        errorMessage: err.message,
      };
    }
  }

  async getOrderStatus(input: SupplierGetStatusInput): Promise<SupplierOrderStatusOutput> {
    if (!this.hasCapability("ORDER_STATUS")) {
      return {
        success: false,
        status: FulfillmentStatus.FAILED,
        errorMessage: "Operação 'ORDER_STATUS' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

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
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        status: FulfillmentStatus.FAILED,
        errorMessage: err.message,
      };
    }
  }

  async getTracking(input: GetSupplierTrackingInput): Promise<GetSupplierTrackingResult> {
    if (!this.hasCapability("TRACKING")) {
      return {
        success: false,
        trackingNumber: input.trackingNumber || "",
        carrier: this.customCarrier,
        status: "EXCEPTION",
        errorMessage: "Operação 'TRACKING' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

      const isDelivered = this.simulatedStatus === FulfillmentStatus.DELIVERED;
      const trackingNumber = input.trackingNumber || this.customTrackingNumber;

      return {
        success: true,
        trackingNumber,
        carrier: this.customCarrier,
        status: isDelivered ? "DELIVERED" : "IN_TRANSIT",
        trackingUrl: `https://rastreamento.correios.com.br/app/index.php?codigo=${trackingNumber}`,
        events: [
          {
            date: new Date(Date.now() - 48 * 3600 * 1000),
            description: "Objeto postado pelo fornecedor",
            location: "Centro de Distribuição - SP",
          },
          {
            date: new Date(Date.now() - 24 * 3600 * 1000),
            description: "Em trânsito para a unidade de tratamento",
            location: "CTE Cajamar - SP",
          },
          ...(isDelivered
            ? [
                {
                  date: new Date(),
                  description: "Objeto entregue ao destinatário",
                  location: "Destino Final",
                },
              ]
            : []),
        ],
        shippedAt: new Date(Date.now() - 48 * 3600 * 1000),
        deliveredAt: isDelivered ? new Date() : undefined,
        rawResponse: { trackingNumber, carrier: this.customCarrier },
      };
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        trackingNumber: input.trackingNumber || "",
        carrier: this.customCarrier,
        status: "EXCEPTION",
        errorMessage: err.message,
      };
    }
  }

  async cancelOrder(input: SupplierCancelOrderInput): Promise<SupplierCancelOrderOutput> {
    if (!this.hasCapability("ORDER_CANCEL")) {
      return {
        success: false,
        cancelled: false,
        errorMessage: "Operação 'ORDER_CANCEL' não suportada pelo fornecedor.",
      };
    }

    try {
      await this.checkSimulationAndDelay();

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
    } catch (err: any) {
      if (err.message?.includes("SUPPLIER_TIMEOUT") || err.message?.includes("SUPPLIER_TRANSIENT_ERROR")) {
        throw err;
      }
      return {
        success: false,
        cancelled: false,
        errorMessage: err.message,
      };
    }
  }
}

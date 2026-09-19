import { MarketplaceAdapter } from "./marketplace-adapter";
import {
  MarketplaceChannel,
  PublishProductInput,
  UpdateProductInput,
  UpdatePriceInput,
  UpdateStockInput,
  MarketplaceOperationResult,
  GetMarketplaceOrderInput,
  GetMarketplaceOrderResult,
  SyncOrdersInput,
  SyncMarketplaceOrdersResult,
} from "../types";

/**
 * Adaptador de Teste / Mock determinístico para Marketplaces
 */
export class TestMarketplaceAdapter implements MarketplaceAdapter {
  readonly channel: MarketplaceChannel = "TEST";
  readonly name = "Test Marketplace Adapter";

  private shouldFail = false;
  private failureErrorMessage = "Erro simulado na API do Marketplace (HTTP 500)";
  private publishedListings = new Map<string, any>();
  private orders = new Map<string, GetMarketplaceOrderResult>();

  constructor(options?: { shouldFail?: boolean; failureErrorMessage?: string }) {
    if (options?.shouldFail !== undefined) this.shouldFail = options.shouldFail;
    if (options?.failureErrorMessage) this.failureErrorMessage = options.failureErrorMessage;
  }

  setShouldFail(shouldFail: boolean, errorMessage?: string) {
    this.shouldFail = shouldFail;
    if (errorMessage) this.failureErrorMessage = errorMessage;
  }

  reset() {
    this.shouldFail = false;
    this.failureErrorMessage = "Erro simulado na API do Marketplace (HTTP 500)";
    this.publishedListings.clear();
    this.orders.clear();
  }

  getListing(sku: string) {
    return this.publishedListings.get(sku);
  }

  async publishProduct(input: PublishProductInput): Promise<MarketplaceOperationResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
      };
    }

    const externalListingId = `MKT-LST-${input.product.sku}-${Date.now()}`;
    this.publishedListings.set(input.product.sku, {
      externalListingId,
      sku: input.product.sku,
      title: input.product.title,
      price: input.product.price,
      stock: input.product.stock,
      status: "ACTIVE",
    });

    return {
      success: true,
      channel: this.channel,
      externalListingId,
      sku: input.product.sku,
      status: "ACTIVE",
      rawResponse: { publishedAt: new Date().toISOString() },
    };
  }

  async updateProduct(input: UpdateProductInput): Promise<MarketplaceOperationResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
      };
    }

    const existing = this.publishedListings.get(input.sku);
    if (existing) {
      if (input.title) existing.title = input.title;
      this.publishedListings.set(input.sku, existing);
    }

    return {
      success: true,
      channel: this.channel,
      externalListingId: input.externalListingId,
      sku: input.sku,
      status: "UPDATED",
      rawResponse: { updatedAt: new Date().toISOString() },
    };
  }

  async updatePrice(input: UpdatePriceInput): Promise<MarketplaceOperationResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
      };
    }

    const existing = this.publishedListings.get(input.sku);
    if (existing) {
      existing.price = input.price;
      this.publishedListings.set(input.sku, existing);
    }

    return {
      success: true,
      channel: this.channel,
      externalListingId: input.externalListingId,
      sku: input.sku,
      status: "UPDATED",
      rawResponse: { newPrice: input.price, updatedAt: new Date().toISOString() },
    };
  }

  async updateStock(input: UpdateStockInput): Promise<MarketplaceOperationResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        status: "FAILED",
        errorMessage: this.failureErrorMessage,
      };
    }

    const existing = this.publishedListings.get(input.sku);
    if (existing) {
      existing.stock = input.stock;
      this.publishedListings.set(input.sku, existing);
    }

    return {
      success: true,
      channel: this.channel,
      externalListingId: input.externalListingId,
      sku: input.sku,
      status: "UPDATED",
      rawResponse: { newStock: input.stock, updatedAt: new Date().toISOString() },
    };
  }

  async getOrder(input: GetMarketplaceOrderInput): Promise<GetMarketplaceOrderResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        externalOrderId: input.externalOrderId,
        status: "CANCELLED",
        totalAmount: 0,
        shippingAmount: 0,
        recipient: { name: "", street: "", city: "", state: "", postalCode: "" },
        items: [],
        errorMessage: this.failureErrorMessage,
      };
    }

    const existingOrder = this.orders.get(input.externalOrderId);
    if (existingOrder) return existingOrder;

    return {
      success: true,
      channel: this.channel,
      externalOrderId: input.externalOrderId,
      channelOrderNumber: `TEST-ORD-${input.externalOrderId}`,
      status: "PAID",
      totalAmount: 129.9,
      shippingAmount: 15.0,
      recipient: {
        name: "Comprador Marketplace Teste",
        cpf: "12345678901",
        phone: "11999998888",
        street: "Av. Paulista",
        number: "1000",
        city: "São Paulo",
        state: "SP",
        postalCode: "01310-100",
      },
      items: [
        {
          sku: "SKU-SHIRT-BLK-M",
          externalItemId: "ITEM-9988",
          name: "Camiseta Algodão Egípcio - Preto / M",
          quantity: 1,
          unitPrice: 114.9,
        },
      ],
    };
  }

  async syncOrders(input: SyncOrdersInput): Promise<SyncMarketplaceOrdersResult> {
    await new Promise((r) => setTimeout(r, 10));

    if (this.shouldFail) {
      return {
        success: false,
        channel: this.channel,
        orders: [],
        totalSynced: 0,
        hasMore: false,
        errorMessage: this.failureErrorMessage,
      };
    }

    const sampleOrder: GetMarketplaceOrderResult = {
      success: true,
      channel: this.channel,
      externalOrderId: `MKT-SYNC-${Date.now()}`,
      channelOrderNumber: "ORD-SYNC-01",
      status: "PAID",
      totalAmount: 89.9,
      shippingAmount: 10.0,
      recipient: {
        name: "Cliente Integrado",
        street: "Rua Augusta",
        city: "São Paulo",
        state: "SP",
        postalCode: "01305-000",
      },
      items: [
        {
          sku: "SKU-MUG-CERAMIC",
          externalItemId: "ITM-01",
          name: "Caneca Cerâmica Fosca",
          quantity: 2,
          unitPrice: 39.95,
        },
      ],
    };

    return {
      success: true,
      channel: this.channel,
      orders: [sampleOrder],
      totalSynced: 1,
      hasMore: false,
    };
  }
}

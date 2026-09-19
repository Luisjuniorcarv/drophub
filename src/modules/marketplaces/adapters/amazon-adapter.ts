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
 * Adaptador Oficial Estruturado para a Amazon Selling Partner API (SP-API)
 * Requer configuração prévia de AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET e AMAZON_SELLER_ID.
 */
export class AmazonAdapter implements MarketplaceAdapter {
  readonly channel: MarketplaceChannel = "AMAZON";
  readonly name = "Amazon Selling Partner API";

  private clientId?: string;
  private clientSecret?: string;
  private sellerId?: string;

  constructor(config?: { clientId?: string; clientSecret?: string; sellerId?: string }) {
    this.clientId = config?.clientId || process.env.AMAZON_LWA_CLIENT_ID;
    this.clientSecret = config?.clientSecret || process.env.AMAZON_LWA_CLIENT_SECRET;
    this.sellerId = config?.sellerId || process.env.AMAZON_SELLER_ID;
  }

  private ensureConfigured(): void {
    if (!this.clientId || !this.clientSecret || !this.sellerId) {
      throw new Error(
        "AMAZON_NOT_CONFIGURED: Credenciais da Amazon SP-API (AMAZON_LWA_CLIENT_ID, AMAZON_LWA_CLIENT_SECRET, AMAZON_SELLER_ID) não configuradas no ambiente."
      );
    }
  }

  async publishProduct(input: PublishProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Publicação SP-API Listings Items aguardando autorização LWA.");
  }

  async updateProduct(input: UpdateProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Atualização de produto aguardando autorização LWA.");
  }

  async updatePrice(input: UpdatePriceInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Atualização de preço aguardando autorização LWA.");
  }

  async updateStock(input: UpdateStockInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Atualização de estoque aguardando autorização LWA.");
  }

  async getOrder(input: GetMarketplaceOrderInput): Promise<GetMarketplaceOrderResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Consulta SP-API Orders aguardando autorização LWA.");
  }

  async syncOrders(input: SyncOrdersInput): Promise<SyncMarketplaceOrdersResult> {
    this.ensureConfigured();
    throw new Error("AMAZON_API_STUB: Sincronização de pedidos aguardando autorização LWA.");
  }
}

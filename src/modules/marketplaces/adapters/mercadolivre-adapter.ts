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
 * Adaptador Oficial Estruturado para o Mercado Livre (MELI API)
 * Requer configuração prévia de MELI_APP_ID e MELI_SECRET_KEY.
 */
export class MercadoLivreAdapter implements MarketplaceAdapter {
  readonly channel: MarketplaceChannel = "MERCADO_LIVRE";
  readonly name = "Mercado Livre API";

  private appId?: string;
  private secretKey?: string;

  constructor(config?: { appId?: string; secretKey?: string }) {
    this.appId = config?.appId || process.env.MELI_APP_ID;
    this.secretKey = config?.secretKey || process.env.MELI_SECRET_KEY;
  }

  private ensureConfigured(): void {
    if (!this.appId || !this.secretKey) {
      throw new Error(
        "MERCADOLIVRE_NOT_CONFIGURED: Credenciais do Mercado Livre (MELI_APP_ID, MELI_SECRET_KEY) não configuradas no ambiente."
      );
    }
  }

  async publishProduct(input: PublishProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Publicação real aguardando autenticação OAuth2 do vendedor.");
  }

  async updateProduct(input: UpdateProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Atualização aguardando autenticação OAuth2 do vendedor.");
  }

  async updatePrice(input: UpdatePriceInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Atualização de preço aguardando autenticação OAuth2 do vendedor.");
  }

  async updateStock(input: UpdateStockInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Atualização de estoque aguardando autenticação OAuth2 do vendedor.");
  }

  async getOrder(input: GetMarketplaceOrderInput): Promise<GetMarketplaceOrderResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Consulta de pedido aguardando autenticação OAuth2 do vendedor.");
  }

  async syncOrders(input: SyncOrdersInput): Promise<SyncMarketplaceOrdersResult> {
    this.ensureConfigured();
    throw new Error("MERCADOLIVRE_API_STUB: Sincronização aguardando autenticação OAuth2 do vendedor.");
  }
}

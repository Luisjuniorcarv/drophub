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
 * Adaptador Oficial Estruturado para a Shopee Open Platform (V2)
 * Requer configuração prévia de SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY e SHOPEE_SHOP_ID.
 */
export class ShopeeAdapter implements MarketplaceAdapter {
  readonly channel: MarketplaceChannel = "SHOPEE";
  readonly name = "Shopee Open Platform";

  private partnerId?: string;
  private partnerKey?: string;
  private shopId?: string;

  constructor(config?: { partnerId?: string; partnerKey?: string; shopId?: string }) {
    this.partnerId = config?.partnerId || process.env.SHOPEE_PARTNER_ID;
    this.partnerKey = config?.partnerKey || process.env.SHOPEE_PARTNER_KEY;
    this.shopId = config?.shopId || process.env.SHOPEE_SHOP_ID;
  }

  private ensureConfigured(): void {
    if (!this.partnerId || !this.partnerKey || !this.shopId) {
      throw new Error(
        "SHOPEE_NOT_CONFIGURED: Credenciais da Shopee Open Platform (SHOPEE_PARTNER_ID, SHOPEE_PARTNER_KEY, SHOPEE_SHOP_ID) não configuradas no ambiente."
      );
    }
  }

  async publishProduct(input: PublishProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    // Estrutura preparada para chamada HTTP real à API da Shopee V2
    throw new Error("SHOPEE_API_STUB: Publicação real aguardando autenticação OAuth2 do lojista.");
  }

  async updateProduct(input: UpdateProductInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("SHOPEE_API_STUB: Atualização de produto aguardando autenticação OAuth2 do lojista.");
  }

  async updatePrice(input: UpdatePriceInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("SHOPEE_API_STUB: Atualização de preço aguardando autenticação OAuth2 do lojista.");
  }

  async updateStock(input: UpdateStockInput): Promise<MarketplaceOperationResult> {
    this.ensureConfigured();
    throw new Error("SHOPEE_API_STUB: Atualização de estoque aguardando autenticação OAuth2 do lojista.");
  }

  async getOrder(input: GetMarketplaceOrderInput): Promise<GetMarketplaceOrderResult> {
    this.ensureConfigured();
    throw new Error("SHOPEE_API_STUB: Consulta de pedido aguardando autenticação OAuth2 do lojista.");
  }

  async syncOrders(input: SyncOrdersInput): Promise<SyncMarketplaceOrdersResult> {
    this.ensureConfigured();
    throw new Error("SHOPEE_API_STUB: Sincronização de pedidos aguardando autenticação OAuth2 do lojista.");
  }
}

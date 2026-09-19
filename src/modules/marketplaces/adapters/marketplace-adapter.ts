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
 * Contrato oficial de integração com qualquer canal de Marketplace externo do DropHub
 */
export interface MarketplaceAdapter {
  readonly channel: MarketplaceChannel | string;
  readonly name: string;

  /**
   * Publica um novo anúncio de produto no marketplace
   */
  publishProduct(input: PublishProductInput): Promise<MarketplaceOperationResult>;

  /**
   * Atualiza dados cadastrais (título, descrição, fotos) do anúncio
   */
  updateProduct(input: UpdateProductInput): Promise<MarketplaceOperationResult>;

  /**
   * Atualiza preço de venda do anúncio
   */
  updatePrice(input: UpdatePriceInput): Promise<MarketplaceOperationResult>;

  /**
   * Atualiza saldo de estoque disponível no anúncio
   */
  updateStock(input: UpdateStockInput): Promise<MarketplaceOperationResult>;

  /**
   * Consulta dados detalhados de um pedido no marketplace
   */
  getOrder(input: GetMarketplaceOrderInput): Promise<GetMarketplaceOrderResult>;

  /**
   * Sincroniza lotes de pedidos recentes do marketplace
   */
  syncOrders(input: SyncOrdersInput): Promise<SyncMarketplaceOrdersResult>;
}

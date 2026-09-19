import { getMarketplaceAdapter } from "./factory";
import {
  MarketplaceChannel,
  MarketplaceProductInput,
  MarketplaceOperationResult,
  MarketplaceSyncSummary,
  GetMarketplaceOrderResult,
} from "./types";

/**
 * Serviço de Sincronização Desacoplada e Resiliente de Marketplaces
 */
export class MarketplaceSyncService {
  /**
   * Publica ou sincroniza um produto nos canais selecionados
   */
  static async syncProductToChannels(
    product: MarketplaceProductInput,
    channels: (MarketplaceChannel | string)[] = ["TEST"]
  ): Promise<MarketplaceSyncSummary> {
    const results: MarketplaceOperationResult[] = [];

    for (const channel of channels) {
      try {
        const adapter = getMarketplaceAdapter(channel);
        const res = await adapter.publishProduct({ product });
        results.push(res);
      } catch (err: any) {
        results.push({
          success: false,
          channel,
          sku: product.sku,
          status: "FAILED",
          errorMessage: err.message,
        });
      }
    }

    const succeeded = results.filter((r) => r.success).length;

    return {
      productId: product.productId,
      sku: product.sku,
      channelsAttempted: channels.length,
      channelsSucceeded: succeeded,
      results,
    };
  }

  /**
   * Sincroniza atualização de preço para múltiplos marketplaces
   */
  static async syncPriceToChannels(params: {
    sku: string;
    externalListings: Array<{ channel: MarketplaceChannel | string; listingId: string }>;
    newPrice: number;
  }): Promise<MarketplaceOperationResult[]> {
    const results: MarketplaceOperationResult[] = [];

    for (const listing of params.externalListings) {
      try {
        const adapter = getMarketplaceAdapter(listing.channel);
        const res = await adapter.updatePrice({
          externalListingId: listing.listingId,
          sku: params.sku,
          price: params.newPrice,
        });
        results.push(res);
      } catch (err: any) {
        results.push({
          success: false,
          channel: listing.channel,
          externalListingId: listing.listingId,
          sku: params.sku,
          status: "FAILED",
          errorMessage: err.message,
        });
      }
    }

    return results;
  }

  /**
   * Sincroniza saldo de estoque para múltiplos canais
   */
  static async syncStockToChannels(params: {
    sku: string;
    externalListings: Array<{ channel: MarketplaceChannel | string; listingId: string }>;
    newStock: number;
  }): Promise<MarketplaceOperationResult[]> {
    const results: MarketplaceOperationResult[] = [];

    for (const listing of params.externalListings) {
      try {
        const adapter = getMarketplaceAdapter(listing.channel);
        const res = await adapter.updateStock({
          externalListingId: listing.listingId,
          sku: params.sku,
          stock: params.newStock,
        });
        results.push(res);
      } catch (err: any) {
        results.push({
          success: false,
          channel: listing.channel,
          externalListingId: listing.listingId,
          sku: params.sku,
          status: "FAILED",
          errorMessage: err.message,
        });
      }
    }

    return results;
  }

  /**
   * Puxa novos pedidos de um marketplace com isolamento
   */
  static async pollChannelOrders(
    channel: MarketplaceChannel | string,
    since?: Date
  ): Promise<{ success: boolean; orders: GetMarketplaceOrderResult[]; errorMessage?: string }> {
    try {
      const adapter = getMarketplaceAdapter(channel);
      const res = await adapter.syncOrders({ since });
      return {
        success: res.success,
        orders: res.orders,
        errorMessage: res.errorMessage,
      };
    } catch (err: any) {
      return {
        success: false,
        orders: [],
        errorMessage: err.message,
      };
    }
  }
}

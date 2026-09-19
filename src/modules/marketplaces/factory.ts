import { MarketplaceAdapter } from "./adapters/marketplace-adapter";
import { TestMarketplaceAdapter } from "./adapters/test-marketplace-adapter";
import { ShopeeAdapter } from "./adapters/shopee-adapter";
import { MercadoLivreAdapter } from "./adapters/mercadolivre-adapter";
import { AmazonAdapter } from "./adapters/amazon-adapter";
import { MarketplaceChannel } from "./types";

let globalTestMarketplaceInstance: TestMarketplaceAdapter | null = null;

export function getTestMarketplaceAdapter(): TestMarketplaceAdapter {
  if (!globalTestMarketplaceInstance) {
    globalTestMarketplaceInstance = new TestMarketplaceAdapter();
  }
  return globalTestMarketplaceInstance;
}

export function setGlobalTestMarketplaceAdapter(adapter: TestMarketplaceAdapter | null) {
  globalTestMarketplaceInstance = adapter;
}

/**
 * Factory de Adaptadores de Marketplaces
 */
export function getMarketplaceAdapter(channel: MarketplaceChannel | string): MarketplaceAdapter {
  const normalized = (channel || "").toUpperCase().trim();

  switch (normalized) {
    case "SHOPEE":
      return new ShopeeAdapter();
    case "MERCADO_LIVRE":
    case "MELI":
    case "MERCADOLIVRE":
      return new MercadoLivreAdapter();
    case "AMAZON":
      return new AmazonAdapter();
    case "TEST":
    default:
      return getTestMarketplaceAdapter();
  }
}

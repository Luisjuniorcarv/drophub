import { SupplierAdapter } from "./adapters/supplier-adapter";
import { TestSupplierAdapter } from "./adapters/test-supplier-adapter";
import { AliExpressAdapter } from "./adapters/aliexpress-adapter";
import { CJDropshippingAdapter } from "./adapters/cj-dropshipping-adapter";
import {
  SupplierCapability,
  SupplierProviderDefinition,
  ALL_SUPPLIER_CAPABILITIES,
  IntegrationErrorCategory,
} from "./types";

let globalTestAdapterInstance: TestSupplierAdapter | null = null;
let globalAliExpressAdapterInstance: AliExpressAdapter | null = null;
let globalCJDropshippingAdapterInstance: CJDropshippingAdapter | null = null;

/**
 * Catálogo Oficial de Provedores de Fornecedores Suportados pelo DropHub
 */
export const REGISTERED_SUPPLIER_PROVIDERS: readonly SupplierProviderDefinition[] = [
  {
    key: "ALIEXPRESS",
    name: "AliExpress & DSers (Dropshipping Automático)",
    description: "Automação completa para envio de pedidos e compras no AliExpress via DSers/Webhook.",
    capabilities: ALL_SUPPLIER_CAPABILITIES,
    isAvailable: true,
    isMock: false,
  },
  {
    key: "CJ_DROPSHIPPING",
    name: "CJ Dropshipping Oficial (API 2.0)",
    description: "Integração direta com o catálogo global, faturamento e despacho do CJ Dropshipping.",
    capabilities: ALL_SUPPLIER_CAPABILITIES,
    isAvailable: true,
    isMock: false,
  },
  {
    key: "TEST",
    name: "Fornecedor de Testes (Mock Determinístico)",
    description: "Ambiente isolado para testes automatizados e validações de fluxo end-to-end.",
    capabilities: ALL_SUPPLIER_CAPABILITIES,
    isAvailable: true,
    isMock: true,
  },
  {
    key: "GENERIC_REST",
    name: "API REST Genérica (Customizável)",
    description: "Integração HTTP segura com URL base, autenticação customizável e proteção SSRF.",
    capabilities: ["PRODUCTS", "STOCK", "PRICE", "ORDER_CREATE", "ORDER_STATUS", "TRACKING"],
    isAvailable: true,
    isMock: false,
  },
  {
    key: "BLING",
    name: "Bling ERP (Aguardando Especificação Oficial)",
    description: "Integração com Bling ERP (requer credenciais e documentação oficial).",
    capabilities: ["PRODUCTS", "STOCK", "PRICE", "ORDER_CREATE", "ORDER_STATUS", "TRACKING"],
    isAvailable: false,
    isMock: false,
  },
  {
    key: "TINY",
    name: "Tiny ERP (Aguardando Especificação Oficial)",
    description: "Integração com Tiny ERP (requer credenciais e documentação oficial).",
    capabilities: ["PRODUCTS", "STOCK", "PRICE", "ORDER_CREATE", "ORDER_STATUS", "TRACKING"],
    isAvailable: false,
    isMock: false,
  },
] as const;

/**
 * Retorna as definições de todos os provedores registrados
 */
export function listRegisteredProviders(): readonly SupplierProviderDefinition[] {
  return REGISTERED_SUPPLIER_PROVIDERS;
}

/**
 * Obtém a definição de um provedor específico
 */
export function getProviderDefinition(providerKey?: string | null): SupplierProviderDefinition | undefined {
  const normalized = (providerKey || "").toUpperCase().trim();
  return REGISTERED_SUPPLIER_PROVIDERS.find((p) => p.key === normalized);
}

/**
 * Retorna ou inicializa a instância padrão do adaptador de teste para fornecedores
 */
export function getTestSupplierAdapter(): TestSupplierAdapter {
  if (!globalTestAdapterInstance) {
    globalTestAdapterInstance = new TestSupplierAdapter();
  }
  return globalTestAdapterInstance;
}

/**
 * Permite injetar um adaptador específico em tempo de execução/testes
 */
export function setGlobalTestSupplierAdapter(adapter: TestSupplierAdapter | null) {
  globalTestAdapterInstance = adapter;
}

/**
 * Adaptador padrão para provedores não implementados ou não configurados
 */
export class UnconfiguredSupplierAdapter implements SupplierAdapter {
  readonly name: string;
  readonly provider: string;
  readonly isMock = false;
  readonly capabilities: ReadonlySet<SupplierCapability> = new Set<SupplierCapability>();

  constructor(providerName: string) {
    this.name = providerName;
    this.provider = providerName;
  }

  hasCapability(_capability: SupplierCapability): boolean {
    return false;
  }

  async testConnection(): Promise<any> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `O provedor '${this.provider}' ainda não possui integração nativa implementada.`,
    };
  }

  async getProducts(): Promise<any> {
    return {
      success: false,
      products: [],
      total: 0,
      page: 1,
      hasMore: false,
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async getStock(): Promise<any> {
    return {
      success: false,
      items: [],
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async getPrice(): Promise<any> {
    return {
      success: false,
      items: [],
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async createOrder(): Promise<any> {
    return {
      success: false,
      status: "FAILED",
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async getOrder(input: any): Promise<any> {
    return {
      success: false,
      status: "FAILED",
      externalOrderId: input?.externalOrderId || "",
      items: [],
      totalCost: 0,
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async getOrderStatus(): Promise<any> {
    return {
      success: false,
      status: "FAILED",
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async getTracking(): Promise<any> {
    return {
      success: false,
      trackingNumber: "",
      carrier: "",
      status: "EXCEPTION",
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }

  async cancelOrder(): Promise<any> {
    return {
      success: false,
      cancelled: false,
      category: "NOT_CONFIGURED" as IntegrationErrorCategory,
      errorMessage: `Provedor ${this.provider} não configurado.`,
    };
  }
}

/**
 * Factory responsável por resolver o adaptador de fornecedor correto
 */
export function getSupplierAdapter(providerOrSupplierName?: string | null): SupplierAdapter {
  const normalized = (providerOrSupplierName || "").toUpperCase().trim();

  switch (normalized) {
    case "ALIEXPRESS":
    case "DSERS":
    case "ALIEXPRESS_DSERS":
      if (!globalAliExpressAdapterInstance) {
        globalAliExpressAdapterInstance = new AliExpressAdapter();
      }
      return globalAliExpressAdapterInstance;
    case "CJ_DROPSHIPPING":
    case "CJDROPSHIPPING":
    case "CJ":
      if (!globalCJDropshippingAdapterInstance) {
        globalCJDropshippingAdapterInstance = new CJDropshippingAdapter();
      }
      return globalCJDropshippingAdapterInstance;
    case "TEST":
    case "TEST_SUPPLIER":
    case "DEFAULT":
    case "":
      return getTestSupplierAdapter();
    case "GENERIC_REST":
    case "UNCONFIGURED":
    case "BLING":
    case "TINY":
      return new UnconfiguredSupplierAdapter(normalized);
    default:
      if (normalized.includes("ALIEXPRESS") || normalized.includes("DSERS")) {
        if (!globalAliExpressAdapterInstance) globalAliExpressAdapterInstance = new AliExpressAdapter();
        return globalAliExpressAdapterInstance;
      }
      if (normalized.includes("CJ")) {
        if (!globalCJDropshippingAdapterInstance) globalCJDropshippingAdapterInstance = new CJDropshippingAdapter();
        return globalCJDropshippingAdapterInstance;
      }
      return getTestSupplierAdapter();
  }
}

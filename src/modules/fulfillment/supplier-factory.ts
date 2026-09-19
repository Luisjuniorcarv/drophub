import { SupplierAdapter } from "./adapters/supplier-adapter";
import { TestSupplierAdapter } from "./adapters/test-supplier-adapter";

let globalTestAdapterInstance: TestSupplierAdapter | null = null;

/**
 * Retorna ou inicializa a instância padrão do adaptador de teste
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
class UnconfiguredSupplierAdapter implements SupplierAdapter {
  readonly name: string;
  readonly provider: string;

  constructor(providerName: string) {
    this.name = providerName;
    this.provider = providerName;
  }

  async testConnection(): Promise<any> {
    return {
      success: false,
      status: "NOT_CONFIGURED",
      errorMessage: `O provedor '${this.provider}' ainda não possui integração nativa implementada.`,
    };
  }

  async createOrder(): Promise<any> {
    return { success: false, status: "FAILED", errorMessage: `Provedor ${this.provider} não configurado.` };
  }

  async getOrderStatus(): Promise<any> {
    return { success: false, status: "FAILED", errorMessage: `Provedor ${this.provider} não configurado.` };
  }

  async cancelOrder(): Promise<any> {
    return { success: false, cancelled: false, errorMessage: `Provedor ${this.provider} não configurado.` };
  }
}

/**
 * Factory responsável por resolver o adaptador de fornecedor correto
 */
export function getSupplierAdapter(providerOrSupplierName?: string | null): SupplierAdapter {
  const normalized = (providerOrSupplierName || "").toUpperCase().trim();

  switch (normalized) {
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
      return getTestSupplierAdapter();
  }
}

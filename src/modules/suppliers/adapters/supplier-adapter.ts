import {
  SupplierCapability,
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
} from "../types";

/**
 * Contrato oficial de comunicação com qualquer fornecedor externo do DropHub (Etapa 12/16/17)
 */
export interface SupplierAdapter {
  readonly name: string;
  readonly provider?: string;
  readonly isMock?: boolean;
  readonly capabilities?: ReadonlySet<SupplierCapability> | readonly SupplierCapability[];
  readonly rateLimit?: {
    requests: number;
    windowMs: number;
  };

  /**
   * Verifica se o adaptador suporta uma determinada funcionalidade
   */
  hasCapability?(capability: SupplierCapability): boolean;

  /**
   * Executa teste de conectividade e validação de credenciais com o fornecedor
   */
  testConnection(
    credentials?: Record<string, any> | null,
    config?: Record<string, any> | null
  ): Promise<TestConnectionResult>;

  /**
   * Consulta catálogo de produtos do fornecedor
   */
  getProducts(input?: GetSupplierProductsInput): Promise<GetSupplierProductsResult>;

  /**
   * Consulta estoque em tempo real de SKUs
   */
  getStock(input: GetSupplierStockInput): Promise<GetSupplierStockResult>;

  /**
   * Consulta preços e custos atualizados de SKUs
   */
  getPrice(input: GetSupplierPriceInput): Promise<GetSupplierPriceResult>;

  /**
   * Envia uma nova ordem de compra/fulfillment para o fornecedor
   */
  createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderOutput>;

  /**
   * Consulta os dados completos de um pedido no fornecedor
   */
  getOrder(input: GetSupplierOrderInput): Promise<GetSupplierOrderResult>;

  /**
   * Consulta o status atual do pedido (retrocompatibilidade com Fulfillment)
   */
  getOrderStatus(input: SupplierGetStatusInput): Promise<SupplierOrderStatusOutput>;

  /**
   * Consulta dados e eventos de rastreamento logístico
   */
  getTracking(input: GetSupplierTrackingInput): Promise<GetSupplierTrackingResult>;

  /**
   * Solicita o cancelamento da ordem no fornecedor
   */
  cancelOrder(input: SupplierCancelOrderInput): Promise<SupplierCancelOrderOutput>;
}

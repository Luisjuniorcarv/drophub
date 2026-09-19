import {
  SupplierCreateOrderInput,
  SupplierCreateOrderOutput,
  SupplierGetStatusInput,
  SupplierOrderStatusOutput,
  SupplierCancelOrderInput,
  SupplierCancelOrderOutput,
} from "../types";

/**
 * Contrato oficial de comunicação com qualquer fornecedor do DropHub
 */
export interface SupplierAdapter {
  readonly name: string;
  readonly provider?: string;
  readonly rateLimit?: {
    requests: number;
    windowMs: number;
  };

  /**
   * Executa teste de conectividade e validação de credenciais com o fornecedor
   */
  testConnection?(
    credentials?: Record<string, any> | null,
    config?: Record<string, any> | null
  ): Promise<{ success: boolean; status?: string; message?: string; errorMessage?: string; rawResponse?: any }>;

  /**
   * Envia a ordem de fulfillment para o fornecedor
   */
  createOrder(input: SupplierCreateOrderInput): Promise<SupplierCreateOrderOutput>;

  /**
   * Consulta o status atualizado do pedido no fornecedor
   */
  getOrderStatus(input: SupplierGetStatusInput): Promise<SupplierOrderStatusOutput>;

  /**
   * Solicita o cancelamento da ordem no fornecedor
   */
  cancelOrder(input: SupplierCancelOrderInput): Promise<SupplierCancelOrderOutput>;
}

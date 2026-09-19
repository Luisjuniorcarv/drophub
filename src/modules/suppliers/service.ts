import { getSupplierAdapter } from "./factory";
import {
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
  GetSupplierTrackingInput,
  GetSupplierTrackingResult,
} from "./types";

/**
 * Utilitário de retentativa exponencial com jitter para chamadas a fornecedores
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  options?: {
    maxRetries?: number;
    initialDelayMs?: number;
    backoffFactor?: number;
  }
): Promise<T> {
  const maxRetries = options?.maxRetries ?? 3;
  const initialDelayMs = options?.initialDelayMs ?? 50;
  const backoffFactor = options?.backoffFactor ?? 2;

  let lastError: any;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (err: any) {
      lastError = err;
      if (attempt === maxRetries) break;
      const delay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  throw lastError;
}

/**
 * Serviço de Integração de Fornecedores do DropHub
 */
export class SupplierIntegrationService {
  /**
   * Consulta catálogo de produtos do fornecedor com retentativa
   */
  static async fetchSupplierCatalog(
    supplierName?: string | null,
    input?: GetSupplierProductsInput
  ): Promise<GetSupplierProductsResult> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.getProducts(input));
  }

  /**
   * Consulta estoque de SKUs em tempo real
   */
  static async checkRealtimeStock(
    supplierName: string | null | undefined,
    input: GetSupplierStockInput
  ): Promise<GetSupplierStockResult> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.getStock(input));
  }

  /**
   * Consulta preço de custo de SKUs em tempo real
   */
  static async checkRealtimePrice(
    supplierName: string | null | undefined,
    input: GetSupplierPriceInput
  ): Promise<GetSupplierPriceResult> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.getPrice(input));
  }

  /**
   * Envia ordem ao fornecedor com proteção contra falhas transitórias
   */
  static async submitOrder(
    supplierName: string | null | undefined,
    input: SupplierCreateOrderInput
  ): Promise<SupplierCreateOrderOutput> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.createOrder(input));
  }

  /**
   * Consulta detalhes do pedido
   */
  static async getOrderDetails(
    supplierName: string | null | undefined,
    input: GetSupplierOrderInput
  ): Promise<GetSupplierOrderResult> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.getOrder(input));
  }

  /**
   * Consulta dados de rastreamento
   */
  static async getTrackingInfo(
    supplierName: string | null | undefined,
    input: GetSupplierTrackingInput
  ): Promise<GetSupplierTrackingResult> {
    const adapter = getSupplierAdapter(supplierName);
    return await executeWithRetry(() => adapter.getTracking(input));
  }
}

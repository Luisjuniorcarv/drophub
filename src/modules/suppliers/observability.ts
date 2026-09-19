import { SupplierOperationAuditLog, SupplierCapability, IntegrationErrorCategory } from "./types";
import { maskCredentialsObject } from "@/lib/encryption";

/**
 * Log estruturado de observabilidade e auditoria para operações de fornecedores.
 * Garante que nenhuma credencial, token ou segredo seja gravado nos logs da aplicação.
 */
export class SupplierObservability {
  private static logs: SupplierOperationAuditLog[] = [];
  private static maxInMemoryLogs = 200;

  /**
   * Registra o início de uma operação para medição de latência
   */
  static startOperation(provider: string, supplierId: string, operation: SupplierCapability | "TEST_CONNECTION") {
    const startTime = Date.now();
    const correlationId = `sup-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    return {
      correlationId,
      finish: (
        result: "SUCCESS" | "FAILURE",
        details?: {
          errorMessage?: string;
          category?: IntegrationErrorCategory;
          metadata?: Record<string, any>;
        }
      ): SupplierOperationAuditLog => {
        const durationMs = Date.now() - startTime;
        
        // Sanitizar mensagem de erro e metadados para garantir que não contenham tokens ou chaves
        let sanitizedError = details?.errorMessage;
        if (sanitizedError) {
          sanitizedError = sanitizedError
            .replace(/(Bearer\s+)[A-Za-z0-9-_.]+/gi, "$1[MASKED_TOKEN]")
            .replace(/(key[=:]\s*)[A-Za-z0-9-_.]+/gi, "$1[MASKED_KEY]")
            .replace(/(secret[=:]\s*)[A-Za-z0-9-_.]+/gi, "$1[MASKED_SECRET]");
        }

        const logEntry: SupplierOperationAuditLog = {
          provider,
          supplierId,
          operation,
          result,
          durationMs,
          timestamp: new Date().toISOString(),
          correlationId,
          errorMessage: sanitizedError,
          category: details?.category,
        };

        // Armazenamento em buffer rotativo
        SupplierObservability.logs.unshift(logEntry);
        if (SupplierObservability.logs.length > SupplierObservability.maxInMemoryLogs) {
          SupplierObservability.logs.pop();
        }

        // Emissão de log estruturado seguro
        if (result === "SUCCESS") {
          console.log(`[SUPPLIER_OP] [${provider}] [${operation}] [${durationMs}ms] result=SUCCESS correlationId=${correlationId}`);
        } else {
          console.warn(
            `[SUPPLIER_OP_ERROR] [${provider}] [${operation}] [${durationMs}ms] result=FAILURE category=${details?.category || "UNKNOWN"} error="${sanitizedError}" correlationId=${correlationId}`
          );
        }

        return logEntry;
      },
    };
  }

  /**
   * Retorna os últimos logs operacionais auditados para visualização administrativa
   */
  static getAuditLogs(supplierId?: string, limit = 50): SupplierOperationAuditLog[] {
    let filtered = SupplierObservability.logs;
    if (supplierId) {
      filtered = filtered.filter((l) => l.supplierId === supplierId);
    }
    return filtered.slice(0, limit);
  }

  /**
   * Limpa o buffer de auditoria (útil para testes unitários)
   */
  static clearLogs() {
    SupplierObservability.logs = [];
  }
}

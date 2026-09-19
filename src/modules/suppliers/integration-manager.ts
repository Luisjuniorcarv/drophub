import { prisma } from "@/lib/prisma";
import { IntegrationStatus } from "@prisma/client";
import { SupplierCredentialService, MaskedIntegrationOutput, SaveCredentialsInput } from "./credential-service";
import { getSupplierAdapter, getProviderDefinition } from "./factory";
import { SupplierAdapter } from "./adapters/supplier-adapter";
import {
  TestConnectionResult,
  IntegrationErrorCategory,
  SupplierCapability,
  SupplierIntegrationContext,
  adapterSupportsCapability,
} from "./types";
import { validateSafeUrl, validateAndSanitizeHeaders } from "@/lib/network-security";
import { SupplierObservability } from "./observability";

export interface SupplierIntegrationListItem {
  supplierId: string;
  supplierName: string;
  provider: string;
  status: IntegrationStatus;
  isConfigured: boolean;
  capabilities: readonly SupplierCapability[];
  maskedCredentials: Record<string, any>;
  configuration: Record<string, any> | null;
  lastTestedAt: Date | null;
  lastError: string | null;
}

/**
 * Gerenciador Central de Integrações de Fornecedores do DropHub
 * - Desacopla o núcleo de pedidos e catálogo das especificidades de cada provedor
 * - Gerencia o ciclo de vida: Configurar -> Testar -> Ativar -> Desativar
 * - Fornece contexto seguro sem expor credenciais
 * - Aplica proteções rigorosas contra SSRF, DNS Rebinding e Header Injection
 * - Audita todas as operações através do SupplierObservability sem expor segredos
 */
export class SupplierIntegrationManager {
  /**
   * Retorna a lista de capacidades suportadas por um provedor
   */
  static getProviderCapabilities(providerName?: string | null): readonly SupplierCapability[] {
    const def = getProviderDefinition(providerName);
    if (def) return def.capabilities;
    const adapter = getSupplierAdapter(providerName);
    if (adapter.capabilities instanceof Set) {
      return Array.from(adapter.capabilities);
    }
    if (Array.isArray(adapter.capabilities)) {
      return adapter.capabilities;
    }
    return [];
  }

  /**
   * Lista todos os fornecedores com suas respectivas configurações de integração mascaradas
   */
  static async listIntegrations(filters?: {
    status?: IntegrationStatus;
    provider?: string;
    search?: string;
  }): Promise<SupplierIntegrationListItem[]> {
    const where: any = {};

    if (filters?.search) {
      where.name = { contains: filters.search.trim(), mode: "insensitive" };
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      include: { integration: true },
      orderBy: { name: "asc" },
    });

    const items: SupplierIntegrationListItem[] = [];

    for (const s of suppliers) {
      if (s.integration) {
        if (filters?.status && s.integration.status !== filters.status) continue;
        if (filters?.provider && s.integration.provider !== filters.provider.toUpperCase()) continue;

        const masked = await SupplierCredentialService.getMaskedIntegration(s.id);
        if (masked) {
          items.push({
            supplierId: s.id,
            supplierName: s.name,
            provider: masked.provider,
            status: masked.status,
            isConfigured: masked.isConfigured,
            capabilities: masked.capabilities,
            maskedCredentials: masked.maskedCredentials,
            configuration: masked.configuration,
            lastTestedAt: masked.lastTestedAt,
            lastError: masked.lastError,
          });
          continue;
        }
      }

      // Fornecedor sem registro de integração
      if (!filters?.status || filters.status === IntegrationStatus.NOT_CONFIGURED) {
        const defaultCapabilities = this.getProviderCapabilities("TEST");
        items.push({
          supplierId: s.id,
          supplierName: s.name,
          provider: "TEST",
          status: IntegrationStatus.NOT_CONFIGURED,
          isConfigured: false,
          capabilities: defaultCapabilities,
          maskedCredentials: {},
          configuration: null,
          lastTestedAt: null,
          lastError: null,
        });
      }
    }

    return items;
  }

  /**
   * Obtém os detalhes de integração de um fornecedor específico de forma mascarada
   */
  static async getIntegration(supplierId: string): Promise<MaskedIntegrationOutput | null> {
    return await SupplierCredentialService.getMaskedIntegration(supplierId);
  }

  /**
   * Salva ou atualiza a integração e credenciais de um fornecedor
   */
  static async configureIntegration(
    supplierId: string,
    input: Omit<SaveCredentialsInput, "supplierId">
  ): Promise<MaskedIntegrationOutput> {
    // Validação preventiva de URL Base contra SSRF
    if (input.configuration?.baseUrl) {
      const urlCheck = await validateSafeUrl(input.configuration.baseUrl);
      if (!urlCheck.isValid) {
        throw new Error(`SSRF_BLOCKED: ${urlCheck.errorMessage}`);
      }
    }

    // Validação de cabeçalhos contra Header Injection
    if (input.configuration?.authHeader) {
      if (/[\r\n\0]/.test(input.configuration.authHeader)) {
        throw new Error("INVALID_AUTH_HEADER: Caracteres de controle ilegais (CRLF) no cabeçalho de autenticação.");
      }
    }

    return await SupplierCredentialService.saveCredentials({
      supplierId,
      ...input,
    });
  }

  /**
   * Executa teste de conectividade e autenticação com o fornecedor
   */
  static async testConnection(supplierId: string): Promise<TestConnectionResult> {
    const op = SupplierObservability.startOperation("UNKNOWN", supplierId, "TEST_CONNECTION");

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { integration: true },
    });

    if (!supplier) {
      op.finish("FAILURE", {
        category: "NOT_CONFIGURED",
        errorMessage: "Fornecedor não encontrado.",
      });
      return {
        success: false,
        status: "FAILED",
        errorMessage: "Fornecedor não encontrado.",
        category: "NOT_CONFIGURED",
      };
    }

    if (supplier.integration?.status === IntegrationStatus.DISABLED) {
      op.finish("FAILURE", {
        category: "NOT_CONFIGURED",
        errorMessage: "Integração desativada manualmente pelo operador.",
      });
      return {
        success: false,
        status: "FAILED",
        errorMessage: "Integração desativada manualmente pelo operador. Ative a integração antes de testar.",
        category: "NOT_CONFIGURED",
      };
    }

    const { credentials, configuration, provider } =
      await SupplierCredentialService.getDecryptedCredentials(supplierId);

    // Validação de segurança SSRF da URL antes de qualquer chamada de rede
    if (configuration?.baseUrl) {
      const urlCheck = await validateSafeUrl(configuration.baseUrl);
      if (!urlCheck.isValid) {
        const errorMsg = `URL de integração inválida ou proibida por segurança (SSRF): ${urlCheck.errorMessage}`;
        await SupplierCredentialService.updateIntegrationTestResult(supplierId, {
          success: false,
          errorMessage: errorMsg,
          newStatus: IntegrationStatus.ERROR,
        });

        op.finish("FAILURE", {
          category: "INVALID_CREDENTIALS",
          errorMessage: errorMsg,
        });

        return {
          success: false,
          status: "FAILED",
          errorMessage: errorMsg,
          category: "INVALID_CREDENTIALS",
        };
      }
    }

    const adapter = this.resolveAdapter(provider);

    try {
      const testResult = await adapter.testConnection(credentials, configuration);

      // Atualizar status no banco de dados
      await SupplierCredentialService.updateIntegrationTestResult(supplierId, {
        success: testResult.success,
        errorMessage: testResult.success ? null : testResult.errorMessage || "Falha na validação de conexão",
        newStatus: testResult.success ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR,
      });

      const auditLog = op.finish(testResult.success ? "SUCCESS" : "FAILURE", {
        category: testResult.category,
        errorMessage: testResult.errorMessage,
      });

      return {
        success: testResult.success,
        status: testResult.success ? "CONNECTED" : "FAILED",
        message: testResult.message || (testResult.success ? "Conexão estabelecida com sucesso." : undefined),
        errorMessage: testResult.errorMessage,
        category: testResult.category || (testResult.success ? undefined : "UNKNOWN_ERROR"),
        rawResponse: testResult.rawResponse,
        latencyMs: auditLog.durationMs,
      };
    } catch (err: any) {
      const errorMessage = err.message || "Erro inesperado ao conectar com fornecedor.";
      await SupplierCredentialService.updateIntegrationTestResult(supplierId, {
        success: false,
        errorMessage,
        newStatus: IntegrationStatus.ERROR,
      });

      const auditLog = op.finish("FAILURE", {
        category: "UNKNOWN_ERROR",
        errorMessage,
      });

      return {
        success: false,
        status: "FAILED",
        errorMessage,
        category: "UNKNOWN_ERROR",
        latencyMs: auditLog.durationMs,
      };
    }
  }

  /**
   * Executa uma operação contra o fornecedor com verificação de capacidades e ciclo de vida
   */
  static async executeGuardedOperation<T>(
    supplierId: string,
    capability: SupplierCapability,
    fn: (adapter: SupplierAdapter, context: SupplierIntegrationContext) => Promise<T>
  ): Promise<{ success: boolean; data?: T; errorMessage?: string; category?: IntegrationErrorCategory }> {
    const { credentials, configuration, provider, status } =
      await SupplierCredentialService.getDecryptedCredentials(supplierId);

    const op = SupplierObservability.startOperation(provider, supplierId, capability);

    if (status === IntegrationStatus.DISABLED || status === IntegrationStatus.NOT_CONFIGURED) {
      op.finish("FAILURE", {
        category: "NOT_CONFIGURED",
        errorMessage: `Integração não está ativa (Status: ${status}).`,
      });
      return {
        success: false,
        category: "NOT_CONFIGURED",
        errorMessage: `A integração com o fornecedor está ${status === IntegrationStatus.DISABLED ? "desativada" : "não configurada"}.`,
      };
    }

    const adapter = this.resolveAdapter(provider);

    if (!adapterSupportsCapability(adapter, capability)) {
      op.finish("FAILURE", {
        category: "OPERATION_NOT_SUPPORTED",
        errorMessage: `A operação '${capability}' não é suportada pelo provedor '${provider}'.`,
      });
      return {
        success: false,
        category: "OPERATION_NOT_SUPPORTED",
        errorMessage: `A operação '${capability}' não é suportada pelo provedor '${provider}'.`,
      };
    }

    try {
      const result = await fn(adapter, {
        supplierId,
        provider,
        credentials,
        configuration,
      });

      op.finish("SUCCESS");
      return { success: true, data: result };
    } catch (err: any) {
      op.finish("FAILURE", {
        category: "UNKNOWN_ERROR",
        errorMessage: err.message,
      });
      return {
        success: false,
        category: "UNKNOWN_ERROR",
        errorMessage: err.message || "Falha ao executar operação no fornecedor.",
      };
    }
  }

  /**
   * Ativa a integração de um fornecedor com validações estritas server-side
   */
  static async enableIntegration(supplierId: string): Promise<MaskedIntegrationOutput> {
    const integration = await prisma.supplierIntegration.findUnique({
      where: { supplierId },
    });

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND: Configuração de integração não encontrada.");
    }

    if (integration.status === IntegrationStatus.NOT_CONFIGURED) {
      throw new Error(
        "CANNOT_ENABLE_UNCONFIGURED_INTEGRATION: Não é possível ativar uma integração sem credenciais ou parâmetros válidos configurados."
      );
    }

    // Se o provedor exigir credenciais e estiver vazio
    if (integration.provider !== "TEST" && !integration.encryptedCredentials) {
      throw new Error(
        "CANNOT_ENABLE_WITHOUT_CREDENTIALS: É obrigatório cadastrar credenciais válidas antes de ativar a integração deste provedor."
      );
    }

    // Se houver URL Base, validar contra SSRF
    const config = (integration.configurationJson as any) || {};
    if (config.baseUrl) {
      const urlCheck = await validateSafeUrl(config.baseUrl);
      if (!urlCheck.isValid) {
        throw new Error(`SSRF_BLOCKED: Não é possível ativar integração com URL insegura: ${urlCheck.errorMessage}`);
      }
    }

    const updated = await prisma.supplierIntegration.update({
      where: { supplierId },
      data: { status: IntegrationStatus.ACTIVE },
    });

    return (await SupplierCredentialService.getMaskedIntegration(supplierId))!;
  }

  /**
   * Desativa a integração de um fornecedor
   */
  static async disableIntegration(supplierId: string): Promise<MaskedIntegrationOutput> {
    const integration = await prisma.supplierIntegration.findUnique({
      where: { supplierId },
    });

    if (!integration) {
      throw new Error("INTEGRATION_NOT_FOUND: Configuração de integração não encontrada.");
    }

    await prisma.supplierIntegration.update({
      where: { supplierId },
      data: { status: IntegrationStatus.DISABLED },
    });

    return (await SupplierCredentialService.getMaskedIntegration(supplierId))!;
  }

  /**
   * Remove a integração e credenciais de um fornecedor
   */
  static async removeIntegration(supplierId: string): Promise<void> {
    await SupplierCredentialService.removeCredentials(supplierId);
  }

  /**
   * Resolve o adaptador adequado de acordo com o provedor (provider)
   */
  static resolveAdapter(provider?: string | null): SupplierAdapter {
    return getSupplierAdapter(provider);
  }
}

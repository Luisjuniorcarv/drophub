import { prisma } from "@/lib/prisma";
import { IntegrationStatus, Prisma } from "@prisma/client";
import { encryptData, decryptData, maskCredentialsObject } from "@/lib/encryption";
import { SupplierCapability } from "./types";
import { getProviderDefinition } from "./factory";

export interface SaveCredentialsInput {
  supplierId: string;
  provider: string;
  credentials?: Record<string, any> | null;
  configuration?: Record<string, any> | null;
  status?: IntegrationStatus;
}

export interface MaskedIntegrationOutput {
  id: string;
  supplierId: string;
  provider: string;
  status: IntegrationStatus;
  isConfigured: boolean;
  capabilities: readonly SupplierCapability[];
  maskedCredentials: Record<string, any>;
  configuration: Record<string, any> | null;
  lastTestedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Serviço de Gerenciamento Seguro de Credenciais de Integração com Fornecedores
 * - Criptografa credenciais em repouso com AES-256-GCM
 * - Nunca expõe credenciais descriptografadas para o frontend ou logs
 * - Centraliza acesso seguro para adaptadores e gerenciador de integrações
 */
export class SupplierCredentialService {
  /**
   * Salva ou atualiza as credenciais e configurações de integração para um fornecedor
   */
  static async saveCredentials(input: SaveCredentialsInput): Promise<MaskedIntegrationOutput> {
    const { supplierId, provider, credentials, configuration, status } = input;

    const supplier = await prisma.supplier.findUnique({
      where: { id: supplierId },
      include: { integration: true },
    });

    if (!supplier) {
      throw new Error("SUPPLIER_NOT_FOUND: Fornecedor não encontrado.");
    }

    let encryptedCredentials = supplier.integration?.encryptedCredentials || null;

    // Se novas credenciais foram fornecidas, criptografa
    if (credentials && Object.keys(credentials).length > 0) {
      // Mesclar com credenciais já existentes se for uma atualização parcial
      let mergedCredentials = credentials;
      if (supplier.integration?.encryptedCredentials) {
        try {
          const existingDecrypted = decryptData(supplier.integration.encryptedCredentials);
          mergedCredentials = { ...existingDecrypted, ...credentials };
        } catch {
          mergedCredentials = credentials;
        }
      }
      encryptedCredentials = encryptData(mergedCredentials);
    }

    const hasCredentials = Boolean(encryptedCredentials);
    const targetStatus = status || (hasCredentials ? IntegrationStatus.CONFIGURED : IntegrationStatus.NOT_CONFIGURED);

    const integration = await prisma.supplierIntegration.upsert({
      where: { supplierId },
      create: {
        supplierId,
        provider: provider.toUpperCase().trim(),
        status: targetStatus,
        encryptedCredentials,
        configurationJson: configuration ? configuration : undefined,
      },
      update: {
        provider: provider.toUpperCase().trim(),
        status: targetStatus,
        encryptedCredentials,
        configurationJson:
          configuration !== undefined
            ? configuration === null
              ? Prisma.JsonNull
              : configuration
            : undefined,
      },
    });

    return this.toMaskedOutput(integration);
  }

  /**
   * Recupera credenciais descriptografadas (ESTRITAMENTE BACKEND-ONLY)
   */
  static async getDecryptedCredentials<T = Record<string, any>>(
    supplierId: string
  ): Promise<{ credentials: T | null; configuration: Record<string, any> | null; provider: string; status: IntegrationStatus }> {
    const integration = await prisma.supplierIntegration.findUnique({
      where: { supplierId },
    });

    if (!integration) {
      return {
        credentials: null,
        configuration: null,
        provider: "TEST",
        status: IntegrationStatus.NOT_CONFIGURED,
      };
    }

    let decrypted: T | null = null;
    if (integration.encryptedCredentials) {
      try {
        decrypted = decryptData<T>(integration.encryptedCredentials);
      } catch (err: any) {
        console.error(`[CREDENTIAL_DECRYPT_ERROR] Falha ao descriptografar credenciais do fornecedor ${supplierId}:`, err.message);
        throw new Error("CREDENTIAL_DECRYPTION_FAILED: Falha na integridade das credenciais salvas.");
      }
    }

    return {
      credentials: decrypted,
      configuration: (integration.configurationJson as Record<string, any>) || null,
      provider: integration.provider,
      status: integration.status,
    };
  }

  /**
   * Obtém a visão segura e mascarada da integração de um fornecedor para exibição em APIs e UI
   */
  static async getMaskedIntegration(supplierId: string): Promise<MaskedIntegrationOutput | null> {
    const integration = await prisma.supplierIntegration.findUnique({
      where: { supplierId },
    });

    if (!integration) {
      return null;
    }

    return this.toMaskedOutput(integration);
  }

  /**
   * Remove todas as credenciais de um fornecedor, redefinindo o status para NOT_CONFIGURED
   */
  static async removeCredentials(supplierId: string): Promise<void> {
    const existing = await prisma.supplierIntegration.findUnique({
      where: { supplierId },
    });

    if (existing) {
      await prisma.supplierIntegration.update({
        where: { supplierId },
        data: {
          encryptedCredentials: null,
          status: IntegrationStatus.NOT_CONFIGURED,
          lastTestedAt: null,
          lastError: null,
        },
      });
    }
  }

  /**
   * Atualiza o status e registros de teste de uma integração
   */
  static async updateIntegrationTestResult(
    supplierId: string,
    result: { success: boolean; errorMessage?: string | null; newStatus?: IntegrationStatus }
  ): Promise<void> {
    const defaultStatus = result.success ? IntegrationStatus.ACTIVE : IntegrationStatus.ERROR;
    const status = result.newStatus || defaultStatus;

    await prisma.supplierIntegration.update({
      where: { supplierId },
      data: {
        status,
        lastTestedAt: new Date(),
        lastError: result.errorMessage || null,
      },
    });
  }

  /**
   * Helper para transformar registro do Prisma em saída mascarada segura
   */
  private static toMaskedOutput(integration: any): MaskedIntegrationOutput {
    let maskedCredentials: Record<string, any> = {};

    if (integration.encryptedCredentials) {
      try {
        const decrypted = decryptData(integration.encryptedCredentials);
        maskedCredentials = maskCredentialsObject(decrypted);
      } catch {
        maskedCredentials = { _error: "Falha ao recuperar credenciais salvas" };
      }
    }

    const providerDef = getProviderDefinition(integration.provider);
    const capabilities = providerDef?.capabilities || [];

    return {
      id: integration.id,
      supplierId: integration.supplierId,
      provider: integration.provider,
      status: integration.status,
      isConfigured: Boolean(integration.encryptedCredentials),
      capabilities,
      maskedCredentials,
      configuration: (integration.configurationJson as Record<string, any>) || null,
      lastTestedAt: integration.lastTestedAt,
      lastError: integration.lastError,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    };
  }
}

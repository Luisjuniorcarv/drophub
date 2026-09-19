import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/modules/auth/service";
import { SupplierIntegrationManager } from "@/modules/suppliers/integration-manager";
import { SupplierIntegrationSaveSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/admin/suppliers/:id/integration
 * Retorna os detalhes de integração e credenciais mascaradas do fornecedor
 */
export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const integration = await SupplierIntegrationManager.getIntegration(id);

    if (!integration) {
      return NextResponse.json({
        success: true,
        integration: {
          supplierId: id,
          provider: "TEST",
          status: "NOT_CONFIGURED",
          isConfigured: false,
          maskedCredentials: {},
          configuration: null,
          lastTestedAt: null,
          lastError: null,
          baseUrl: "",
          authHeader: "Bearer",
          timeoutMs: 10000,
          retryMaxAttempts: 3,
          isActive: false,
          hasApiKey: false,
          hasApiSecret: false,
          hasWebhookSecret: false,
        },
      });
    }

    const config = (integration.configuration as any) || {};
    const flatIntegration = {
      ...integration,
      baseUrl: config.baseUrl || "",
      authHeader: config.authHeader || "Bearer",
      timeoutMs: config.timeoutMs || 10000,
      retryMaxAttempts: config.retryMaxAttempts || 3,
      isActive: integration.status !== "DISABLED",
      hasApiKey: Boolean(integration.maskedCredentials?.apiKey),
      hasApiSecret: Boolean(integration.maskedCredentials?.apiSecret),
      hasWebhookSecret: Boolean(integration.maskedCredentials?.webhookSecret),
      maskedApiKey: integration.maskedCredentials?.apiKey || null,
      maskedApiSecret: integration.maskedCredentials?.apiSecret || null,
      maskedWebhookSecret: integration.maskedCredentials?.webhookSecret || null,
    };

    return NextResponse.json({
      success: true,
      integration: flatIntegration,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_INTEGRATION_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar integração do fornecedor." }, { status: 500 });
  }
}

/**
 * POST /api/admin/suppliers/:id/integration
 * Salva ou atualiza a integração e credenciais com criptografia
 */
export async function POST(req: NextRequest, { params }: Params) {
  return handleSaveIntegration(req, params);
}

/**
 * PUT /api/admin/suppliers/:id/integration
 * Salva ou atualiza a integração e credenciais com criptografia
 */
export async function PUT(req: NextRequest, { params }: Params) {
  return handleSaveIntegration(req, params);
}

async function handleSaveIntegration(req: NextRequest, paramsPromise: Promise<{ id: string }>) {
  try {
    await requireAuth();
    const { id } = await paramsPromise;

    const body = await req.json();
    const parseResult = SupplierIntegrationSaveSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de integração inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const {
      provider,
      credentials,
      configuration,
      status,
      apiKey,
      apiSecret,
      webhookSecret,
      baseUrl,
      authHeader,
      timeoutMs,
      retryMaxAttempts,
      isActive,
    } = parseResult.data;

    let mergedCredentials: Record<string, any> = credentials ? { ...credentials } : {};
    if (apiKey) mergedCredentials.apiKey = apiKey;
    if (apiSecret) mergedCredentials.apiSecret = apiSecret;
    if (webhookSecret) mergedCredentials.webhookSecret = webhookSecret;

    let mergedConfig: Record<string, any> = configuration ? { ...configuration } : {};
    if (baseUrl !== undefined && baseUrl !== null) mergedConfig.baseUrl = baseUrl;
    if (authHeader !== undefined && authHeader !== null) mergedConfig.authHeader = authHeader;
    if (timeoutMs !== undefined && timeoutMs !== null) mergedConfig.timeoutMs = timeoutMs;
    if (retryMaxAttempts !== undefined && retryMaxAttempts !== null) mergedConfig.retryMaxAttempts = retryMaxAttempts;

    const targetStatus =
      status || (isActive !== undefined ? (isActive ? "ACTIVE" : "DISABLED") : undefined);

    const saved = await SupplierIntegrationManager.configureIntegration(id, {
      provider,
      credentials: Object.keys(mergedCredentials).length > 0 ? mergedCredentials : credentials || undefined,
      configuration: Object.keys(mergedConfig).length > 0 ? mergedConfig : configuration || undefined,
      status: targetStatus as any,
    });

    const savedConfig = (saved.configuration as any) || {};
    const flatSaved = {
      ...saved,
      baseUrl: savedConfig.baseUrl || "",
      authHeader: savedConfig.authHeader || "Bearer",
      timeoutMs: savedConfig.timeoutMs || 10000,
      retryMaxAttempts: savedConfig.retryMaxAttempts || 3,
      isActive: saved.status !== "DISABLED",
      hasApiKey: Boolean(saved.maskedCredentials?.apiKey),
      hasApiSecret: Boolean(saved.maskedCredentials?.apiSecret),
      hasWebhookSecret: Boolean(saved.maskedCredentials?.webhookSecret),
      maskedApiKey: saved.maskedCredentials?.apiKey || null,
      maskedApiSecret: saved.maskedCredentials?.apiSecret || null,
      maskedWebhookSecret: saved.maskedCredentials?.webhookSecret || null,
    };

    return NextResponse.json({
      success: true,
      integration: flatSaved,
      message: "Configuração de integração salva com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    if (error.message?.includes("SUPPLIER_NOT_FOUND")) {
      return NextResponse.json({ error: "Fornecedor não encontrado." }, { status: 404 });
    }
    if (
      error.message?.includes("SSRF_BLOCKED") ||
      error.message?.includes("INVALID_BASE_URL") ||
      error.message?.includes("INVALID_AUTH_HEADER")
    ) {
      return NextResponse.json(
        { error: error.message.split(": ")[1] || error.message },
        { status: 422 }
      );
    }
    console.error("[API_SUPPLIER_INTEGRATION_SAVE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao salvar integração do fornecedor." }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/suppliers/:id/integration
 * Remove credenciais e redefine integração para NOT_CONFIGURED
 */
export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    await SupplierIntegrationManager.removeIntegration(id);

    return NextResponse.json({
      success: true,
      message: "Credenciais de integração removidas com sucesso.",
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_SUPPLIER_INTEGRATION_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao remover integração do fornecedor." }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { logger } from "./logger";

export interface ApiResponseOptions {
  status?: number;
  headers?: Record<string, string>;
}

/**
 * Retorna uma resposta JSON de sucesso padronizada
 */
export function apiSuccess<T extends Record<string, any>>(data?: T, options?: ApiResponseOptions): NextResponse {
  const status = options?.status || 200;
  const headers = options?.headers;

  return NextResponse.json(
    {
      success: true,
      ...(data || {}),
    },
    { status, headers }
  );
}

/**
 * Retorna uma resposta JSON de erro sanitizada para impedir vazamento de dados internos
 */
export function apiError(
  message: string,
  statusCode = 500,
  details?: any,
  options?: ApiResponseOptions
): NextResponse {
  const isProduction = process.env.NODE_ENV === "production";
  const headers = options?.headers;

  // Em produção, nunca vazar stack traces ou mensagens cruas de banco de dados
  const sanitizedDetails = isProduction ? undefined : details;

  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(sanitizedDetails ? { details: sanitizedDetails } : {}),
    },
    { status: statusCode, headers }
  );
}

/**
 * Captura e trata exceções de APIs de forma segura e estruturada
 */
export function handleApiError(
  error: any,
  fallbackMessage = "Ocorreu um erro interno ao processar a requisição.",
  context?: Record<string, any>
): NextResponse {
  const errorMessage = error?.message || String(error);
  const isProduction = process.env.NODE_ENV === "production";

  // Mapeamento de erros conhecidos de negócio para códigos HTTP adequados
  if (errorMessage === "UNAUTHORIZED" || errorMessage.includes("não autorizado")) {
    return apiError("Acesso não autorizado.", 401);
  }

  if (errorMessage === "FORBIDDEN" || errorMessage.includes("Acesso negado")) {
    return apiError("Acesso proibido.", 403);
  }

  if (errorMessage === "NOT_FOUND" || errorMessage.includes("não encontrado")) {
    return apiError(errorMessage === "NOT_FOUND" ? "Recurso não encontrado." : errorMessage, 404);
  }

  if (errorMessage.includes("ALREADY_EXISTS") || errorMessage.includes("Unique constraint")) {
    return apiError("Recurso já cadastrado ou em conflito.", 409);
  }

  // Registrar erro no logger estruturado
  logger.error(fallbackMessage, error, context);

  // Sanitização de erro 500 em produção
  const publicMessage = isProduction ? fallbackMessage : errorMessage;
  return apiError(publicMessage, 500, isProduction ? undefined : error?.stack);
}

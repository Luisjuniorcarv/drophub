import { NextRequest, NextResponse } from "next/server";

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp em segundos
  retryAfter: number; // Segundos até o reset
}

export const RATE_LIMIT_PRESETS: Record<string, RateLimitOptions> = {
  AUTH: { limit: 5, windowMs: 60 * 1000 }, // 5 req por minuto
  FORGOT_PASSWORD: { limit: 3, windowMs: 15 * 60 * 1000 }, // 3 req por 15 min
  CHECKOUT: { limit: 10, windowMs: 60 * 1000 }, // 10 req por minuto
  AI: { limit: 20, windowMs: 60 * 1000 }, // 20 req por minuto
  PUBLIC: { limit: 60, windowMs: 60 * 1000 }, // 60 req por minuto
};

// Armazenamento em memória com sliding window timestamp log
interface RateLimitEntry {
  timestamps: number[];
}

const memoryStore = new Map<string, RateLimitEntry>();

// Limpeza periódica para evitar vazamento de memória (a cada 5 minutos)
if (typeof setInterval !== "undefined") {
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of memoryStore.entries()) {
      entry.timestamps = entry.timestamps.filter((ts) => now - ts < 15 * 60 * 1000);
      if (entry.timestamps.length === 0) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);

  // Desafixa o timer para não segurar o processo Node.js em saída/testes
  if (cleanupInterval.unref) {
    cleanupInterval.unref();
  }
}

/**
 * Verifica o limite de taxa para uma chave específica
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const windowStart = now - options.windowMs;

  let entry = memoryStore.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    memoryStore.set(key, entry);
  }

  // Filtrar timestamps fora da janela atual
  entry.timestamps = entry.timestamps.filter((ts) => ts > windowStart);

  const resetSeconds = Math.ceil((windowStart + options.windowMs) / 1000);
  const oldestTimestamp = entry.timestamps[0] || now;
  const retryAfter = Math.max(1, Math.ceil((oldestTimestamp + options.windowMs - now) / 1000));

  if (entry.timestamps.length >= options.limit) {
    return {
      success: false,
      limit: options.limit,
      remaining: 0,
      reset: resetSeconds,
      retryAfter,
    };
  }

  // Adicionar novo timestamp
  entry.timestamps.push(now);

  return {
    success: true,
    limit: options.limit,
    remaining: Math.max(0, options.limit - entry.timestamps.length),
    reset: resetSeconds,
    retryAfter: 0,
  };
}

/**
 * Reseta o histórico de rate limit para uma chave ou limpa tudo (útil para testes)
 */
export function resetRateLimitStore(key?: string) {
  if (key) {
    memoryStore.delete(key);
  } else {
    memoryStore.clear();
  }
}

/**
 * Extrai o IP real do cliente a partir dos headers de proxy ou do request
 */
export function getClientIp(req: NextRequest | Request): string {
  if ("headers" in req) {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) {
      return forwarded.split(",")[0].trim();
    }
    const realIp = req.headers.get("x-real-ip");
    if (realIp) {
      return realIp.trim();
    }
  }
  return "127.0.0.1";
}

/**
 * Gera headers HTTP padrão de Rate Limit
 */
export function getRateLimitHeaders(result: RateLimitResult): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": result.limit.toString(),
    "X-RateLimit-Remaining": result.remaining.toString(),
    "X-RateLimit-Reset": result.reset.toString(),
  };

  if (!result.success) {
    headers["Retry-After"] = result.retryAfter.toString();
  }

  return headers;
}

/**
 * Retorna uma resposta HTTP 429 padronizada com headers de Rate Limit
 */
export function createRateLimitResponse(result: RateLimitResult, customMessage?: string): NextResponse {
  return NextResponse.json(
    {
      error: customMessage || "Muitas requisições. Por favor, aguarde alguns instantes antes de tentar novamente.",
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: getRateLimitHeaders(result),
    }
  );
}

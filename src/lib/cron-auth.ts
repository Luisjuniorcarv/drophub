import crypto from "crypto";
import { NextRequest } from "next/server";

/**
 * Validação segura de autorização para endpoints de Cron via CRON_SECRET
 * - Aceita cabeçalho 'Authorization: Bearer <secret>' ou 'x-cron-secret: <secret>'
 * - Utiliza comparação em tempo constante (timingSafeEqual) para proteção contra timing attacks
 * - Nunca registra o segredo em logs
 * - Rejeita se o CRON_SECRET não estiver configurado ou não coincidir
 */
export function validateCronRequest(req: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || cronSecret.trim().length === 0) {
    // Se CRON_SECRET não estiver definido no ambiente, bloqueia por padrão para impedir acesso público acidental
    return false;
  }

  const authHeader = req.headers.get("authorization");
  const customHeader = req.headers.get("x-cron-secret");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.substring(7).trim() : null;

  const candidate = (bearerToken || customHeader || "").trim();

  if (!candidate) {
    return false;
  }

  const expectedBuffer = Buffer.from(cronSecret.trim());
  const candidateBuffer = Buffer.from(candidate);

  if (expectedBuffer.length !== candidateBuffer.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
  } catch {
    return false;
  }
}

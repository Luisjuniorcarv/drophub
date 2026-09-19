import crypto from "crypto";

/**
 * Gera assinatura HMAC-SHA256 para transmissão segura de webhooks
 */
export function generateWebhookSignature(
  payload: string | object,
  secret: string
): string {
  const content = typeof payload === "string" ? payload : JSON.stringify(payload);
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(content, "utf8");
  return `sha256=${hmac.digest("hex")}`;
}

/**
 * Valida a assinatura de um webhook recebido contra timing attacks
 */
export function verifyWebhookSignature(
  payload: string | object,
  secret: string,
  providedSignature: string
): boolean {
  try {
    if (!providedSignature || !secret) return false;

    const expectedSignature = generateWebhookSignature(payload, secret);

    const providedBuffer = Buffer.from(providedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);

    if (providedBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return crypto.timingSafeEqual(providedBuffer, expectedBuffer);
  } catch (err) {
    return false;
  }
}

/**
 * Gera um segredo aleatório seguro para novos webhooks
 */
export function generateWebhookSecret(): string {
  return `whsec_${crypto.randomBytes(24).toString("hex")}`;
}

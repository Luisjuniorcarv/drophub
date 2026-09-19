import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Obtém a chave de 256 bits (32 bytes) para criptografia simétrica AES-256-GCM.
 * Utiliza ENCRYPTION_KEY do ambiente ou deriva a partir do JWT_SECRET.
 */
function getEncryptionKey(): Buffer {
  const secret =
    process.env.ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "drophub_default_encryption_key_2026_fallback_must_be_32_bytes";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Criptografa dados em texto puro ou objeto JSON utilizando AES-256-GCM com tag de autenticação.
 * Formato de saída: iv_hex:authTag_hex:ciphertext_hex
 */
export function encryptData(data: string | Record<string, any>): string {
  const plainText = typeof data === "string" ? data : JSON.stringify(data);
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

/**
 * Decriptografa dados criptografados em formato AES-256-GCM (iv:authTag:ciphertext).
 * Valida integridade criptográfica através do Auth Tag.
 */
export function decryptData<T = any>(encryptedPayload: string): T {
  if (!encryptedPayload || typeof encryptedPayload !== "string") {
    throw new Error("INVALID_ENCRYPTED_PAYLOAD: Payload criptografado vazio ou inválido.");
  }

  const parts = encryptedPayload.split(":");
  if (parts.length !== 3) {
    throw new Error("INVALID_CIPHERTEXT_FORMAT: Formato inválido de dados criptografados (esperado iv:tag:data).");
  }

  const [ivHex, authTagHex, encryptedHex] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivHex, "hex");
  const authTag = Buffer.from(authTagHex, "hex");

  if (iv.length !== IV_LENGTH || authTag.length !== AUTH_TAG_LENGTH) {
    throw new Error("INVALID_CIPHERTEXT_PARAMS: Tamanho inválido de IV ou AuthTag.");
  }

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encryptedHex, "hex", "utf8");
  decrypted += decipher.final("utf8");

  try {
    return JSON.parse(decrypted) as T;
  } catch {
    return decrypted as unknown as T;
  }
}

/**
 * Mascara strings sensíveis (chaves de API, senhas, tokens) preservando segurança.
 * Exemplo: "sk-1234567890abcdef" -> "sk••••••••ef"
 */
export function maskSecret(value?: string | null): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (trimmed.length <= 6) {
    return "••••••••";
  }
  const prefix = trimmed.slice(0, 2);
  const suffix = trimmed.slice(-2);
  return `${prefix}••••••••${suffix}`;
}

/**
 * Chaves padrão consideradas sensíveis para mascaramento automático em payloads
 */
const SENSITIVE_KEY_PATTERNS = [
  /api[_-]?key/i,
  /api[_-]?secret/i,
  /secret/i,
  /token/i,
  /password/i,
  /senha/i,
  /access[_-]?token/i,
  /private[_-]?key/i,
  /auth/i,
  /authorization/i,
];

/**
 * Mascara recursivamente todos os campos confidenciais de um objeto de credenciais
 */
export function maskCredentialsObject(obj: Record<string, any> | null | undefined): Record<string, any> {
  if (!obj || typeof obj !== "object") return {};

  const result: Record<string, any> = {};

  for (const [key, val] of Object.entries(obj)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some((pattern) => pattern.test(key));

    if (val === null || val === undefined) {
      result[key] = null;
    } else if (typeof val === "object" && !Array.isArray(val)) {
      result[key] = maskCredentialsObject(val);
    } else if (isSensitive && typeof val === "string") {
      result[key] = maskSecret(val);
    } else {
      result[key] = val;
    }
  }

  return result;
}

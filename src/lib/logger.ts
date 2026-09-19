/**
 * Logger estruturado para DropHub com mascaramento automático de dados sensíveis (LGPD e Segurança PCI).
 */

const SENSITIVE_KEYS = new Set([
  "password",
  "senha",
  "passwordhash",
  "cardtoken",
  "cvv",
  "secret",
  "jwt",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "apikey",
]);

/**
 * Mascara recursivamente strings e objetos para evitar vazamento de credenciais e dados pessoais
 */
export function maskSensitiveData(data: any): any {
  if (data === null || data === undefined) return data;

  if (typeof data === "string") {
    return data
      .replace(/sk-[A-Za-z0-9-_]{20,}/g, "sk-***[MASKED]***")
      .replace(/Bearer\s+[A-Za-z0-9-_.]+/gi, "Bearer ***[MASKED]***")
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, "***.***.***-**")
      .replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, "****-****-****-****");
  }

  if (Array.isArray(data)) {
    return data.map(maskSensitiveData);
  }

  if (typeof data === "object") {
    const maskedObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.has(lowerKey)) {
        maskedObj[key] = "***[PROTECTED]***";
      } else {
        maskedObj[key] = maskSensitiveData(value);
      }
    }
    return maskedObj;
  }

  return data;
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  customerId?: string;
  orderId?: string;
  path?: string;
  method?: string;
  durationMs?: number;
  statusCode?: number;
  [key: string]: any;
}

export const logger = {
  info(message: string, context?: LogContext) {
    this.log("INFO", message, context);
  },

  warn(message: string, context?: LogContext) {
    this.log("WARN", message, context);
  },

  error(message: string, error?: any, context?: LogContext) {
    const errorDetails = error instanceof Error
      ? { message: error.message, stack: process.env.NODE_ENV === "development" ? error.stack : undefined }
      : error;

    this.log("ERROR", message, {
      ...context,
      error: errorDetails,
    });
  },

  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      this.log("DEBUG", message, context);
    }
  },

  log(level: "INFO" | "WARN" | "ERROR" | "DEBUG", message: string, context?: LogContext) {
    const timestamp = new Date().toISOString();
    const maskedContext = context ? maskSensitiveData(context) : undefined;

    if (process.env.NODE_ENV === "production") {
      // Formato JSON estruturado para observabilidade em Docker/EasyPanel/Datadog/CloudWatch
      const logEntry = {
        timestamp,
        level,
        service: "drophub",
        message,
        ...maskedContext,
      };
      console.log(JSON.stringify(logEntry));
    } else {
      // Formato legível para ambiente de desenvolvimento
      const prefix = `[${timestamp}] [${level}]`;
      if (level === "ERROR") {
        console.error(prefix, message, maskedContext || "");
      } else if (level === "WARN") {
        console.warn(prefix, message, maskedContext || "");
      } else {
        console.log(prefix, message, maskedContext || "");
      }
    }
  },
};

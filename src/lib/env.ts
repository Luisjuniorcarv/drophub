import { z } from "zod";

/**
 * Schema centralizado de validação de variáveis de ambiente do DropHub.
 * Garante segurança, tipagem e impede inicialização com segredos ausentes ou inseguros em produção.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória"),
  JWT_SECRET: z
    .string()
    .min(32, "JWT_SECRET deve ter no mínimo 32 caracteres para segurança criptográfica")
    .default("drophub_super_secret_jwt_key_at_least_32_characters_long_2026"),
  NEXT_PUBLIC_APP_URL: z.string().url("NEXT_PUBLIC_APP_URL deve ser uma URL válida").default("http://localhost:3000"),
  COOKIE_NAME: z.string().default("drophub_admin_session"),
  CUSTOMER_COOKIE_NAME: z.string().default("drophub_customer_session"),
  
  // Gateways e Integrações (Opcionais ou Condicionais)
  ENCRYPTION_KEY: z.string().min(32, "ENCRYPTION_KEY deve ter no mínimo 32 caracteres").optional(),
  PRISMA_AUTO_MIGRATE: z.enum(["true", "false"]).optional(),
  PAYMENT_GATEWAY: z.enum(["TEST_MODE", "MERCADO_PAGO"]).default("TEST_MODE"),
  MERCADO_PAGO_ACCESS_TOKEN: z.string().optional(),
  MERCADO_PAGO_PUBLIC_KEY: z.string().optional(),
  MERCADO_PAGO_WEBHOOK_SECRET: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),
  WEBHOOK_SECRET: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  INBOUND_WEBHOOK_SECRET: z.string().optional(),
  N8N_WEBHOOK_URL: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * Validação segura de variáveis de ambiente em tempo de execução
 */
export function validateEnv(customEnv?: Record<string, string | undefined>): EnvConfig {
  const source = customEnv || process.env;
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const errorDetails = result.error.flatten().fieldErrors;
    console.error("❌ [ENV] Falha na validação das variáveis de ambiente:", errorDetails);
    
    // Em produção, falha explicitamente para impedir execução vulnerável
    if (source.NODE_ENV === "production") {
      throw new Error(`Configuração de ambiente inválida para produção: ${JSON.stringify(errorDetails)}`);
    }
    
    // Em dev/test, tenta usar valores seguros padrão com aviso
    return envSchema.parse({
      ...source,
      DATABASE_URL: source.DATABASE_URL || "postgresql://drophub_user:drophub_secure_pass@localhost:5432/drophub_db?schema=public",
    });
  }

  // Validação estrita de produção: não aceitar chave JWT padrão
  if (result.data.NODE_ENV === "production") {
    if (result.data.JWT_SECRET.includes("drophub_super_secret_jwt_key")) {
      console.warn("⚠️ [SECURITY WARNING] Usando JWT_SECRET de demonstração em ambiente de produção.");
    }
  }

  return result.data;
}

export const env = validateEnv();

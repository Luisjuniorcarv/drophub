import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import {
  requestPasswordReset,
  resetPasswordWithToken,
  hashToken,
} from "@/modules/customer/password-recovery";
import { maskSensitiveData } from "@/lib/logger";
import { handleApiError } from "@/lib/api-response";

describe("ETAPA 13 — Security & Hardening Integration Tests", () => {
  let testCustomer: any;

  beforeEach(async () => {
    const timestamp = Date.now();
    const testEmail = `hardening_user_${timestamp}@exemplo.com`;
    const cleanCpf = `999${String(timestamp).slice(-8)}`;

    const initialPasswordHash = await bcrypt.hash("SenhaInicial123", 10);

    testCustomer = await prisma.customer.create({
      data: {
        name: "Cliente Hardening",
        email: testEmail,
        cpf: cleanCpf,
        phone: "11999999999",
        passwordHash: initialPasswordHash,
      },
    });
  });

  // ----------------------------------------------------
  // 1. RECUPERAÇÃO DE SENHA, HASH E ANTI-ENUMERAÇÃO
  // ----------------------------------------------------
  it("1. should execute complete password reset lifecycle with SHA-256 hash storage", async () => {
    // 1. Solicitar recuperação
    const reqResult = await requestPasswordReset(testCustomer.email);
    expect(reqResult.success).toBe(true);
    expect(reqResult.devToken).toBeDefined();

    const rawToken = reqResult.devToken!;
    const expectedHash = hashToken(rawToken);

    // 2. Verificar que o token armazenado no banco é o HASH SHA-256 e não o token bruto
    const dbToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: expectedHash },
    });
    expect(dbToken).toBeDefined();
    expect(dbToken?.email).toBe(testCustomer.email);
    expect(dbToken?.usedAt).toBeNull();
    expect(dbToken?.expiresAt.getTime()).toBeGreaterThan(Date.now());

    // 3. Redefinir a senha com o token recebido
    const resetResult = await resetPasswordWithToken(rawToken, "NovaSenhaForte@2026");
    expect(resetResult.success).toBe(true);

    // 4. Verificar que a senha do cliente foi alterada
    const updatedCustomer = await prisma.customer.findUnique({
      where: { id: testCustomer.id },
    });
    expect(updatedCustomer?.passwordHash).toBeDefined();
    const isValid = await bcrypt.compare("NovaSenhaForte@2026", updatedCustomer!.passwordHash!);
    expect(isValid).toBe(true);

    // 5. Verificar que o token foi marcado como utilizado
    const usedToken = await prisma.passwordResetToken.findUnique({
      where: { tokenHash: expectedHash },
    });
    expect(usedToken?.usedAt).not.toBeNull();

    // 6. Tentar reutilizar o mesmo token deve falhar (Uso Único)
    await expect(
      resetPasswordWithToken(rawToken, "OutraSenhaTentativa")
    ).rejects.toThrow("TOKEN_ALREADY_USED");
  });

  it("2. should protect against user enumeration during password reset requests", async () => {
    const nonExistentEmail = "usuario_inexistente_99999@exemplo.com";

    // A resposta deve ser idêntica à de um usuário existente
    const result = await requestPasswordReset(nonExistentEmail);
    expect(result.success).toBe(true);
    expect(result.message).toContain("Se o e-mail informado estiver cadastrado");

    // Nenhum token deve ter sido gravado no banco para o e-mail inexistente
    const dbToken = await prisma.passwordResetToken.findFirst({
      where: { email: nonExistentEmail },
    });
    expect(dbToken).toBeNull();
  });

  it("3. should reject expired or forged tokens", async () => {
    // Token forjado inexistente
    await expect(
      resetPasswordWithToken("token_forjado_com_mais_de_16_caracteres_aleatorios", "Senha123456")
    ).rejects.toThrow("INVALID_TOKEN");

    // Token expirado
    const expiredRawToken = "token_expirado_" + Date.now() + "_" + Math.floor(Math.random() * 10000);
    const expiredHash = hashToken(expiredRawToken);

    await prisma.passwordResetToken.create({
      data: {
        email: testCustomer.email,
        tokenHash: expiredHash,
        expiresAt: new Date(Date.now() - 1000 * 60 * 10), // Expirado há 10 minutos
      },
    });

    await expect(
      resetPasswordWithToken(expiredRawToken, "NovaSenha123")
    ).rejects.toThrow("TOKEN_EXPIRED");
  });

  // ----------------------------------------------------
  // 2. MASCARAMENTO DE DADOS SENSÍVEIS (LOGS & LGPD)
  // ----------------------------------------------------
  it("4. should mask sensitive fields and credentials in structured logs", () => {
    const sensitivePayload = {
      password: "MinhaSenhaSuperSecreta123",
      cardToken: "tok_visa_1234567890",
      cpf: "123.456.789-00",
      apiKey: "sk-proj-abc123xyz7890123456789",
      authorization: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy",
      customer: {
        name: "Carlos Silva",
        email: "carlos@exemplo.com",
        senha: "outrasenha123",
      },
    };

    const masked = maskSensitiveData(sensitivePayload);

    expect(masked.password).toBe("***[PROTECTED]***");
    expect(masked.cardToken).toBe("***[PROTECTED]***");
    expect(masked.apiKey).toBe("***[PROTECTED]***");
    expect(masked.authorization).toBe("***[PROTECTED]***");
    expect(masked.cpf).toBe("***.***.***-**");
    expect(masked.customer.senha).toBe("***[PROTECTED]***");
    expect(masked.customer.name).toBe("Carlos Silva");
  });

  // ----------------------------------------------------
  // 3. TRATAMENTO E SANITIZAÇÃO DE ERROS DE API
  // ----------------------------------------------------
  it("5. should correctly map standard business errors to appropriate HTTP status codes", async () => {
    const unauthRes = handleApiError(new Error("UNAUTHORIZED"));
    expect(unauthRes.status).toBe(401);

    const forbiddenRes = handleApiError(new Error("FORBIDDEN"));
    expect(forbiddenRes.status).toBe(403);

    const notFoundRes = handleApiError(new Error("NOT_FOUND"));
    expect(notFoundRes.status).toBe(404);

    const conflictRes = handleApiError(new Error("Unique constraint failed on field email"));
    expect(conflictRes.status).toBe(409);

    const genericRes = handleApiError(new Error("Erro interno desconhecido no servidor"));
    expect(genericRes.status).toBe(500);
  });
});

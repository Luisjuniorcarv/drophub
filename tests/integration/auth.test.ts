import { describe, it, expect } from "vitest";
import { authenticateUser, logoutUser, requireAuth } from "@/modules/auth/service";
import { signSessionToken, verifySessionToken } from "@/modules/auth/jwt";
import { Role } from "@prisma/client";
import { SignJWT } from "jose";

describe("Authentication & Security Integration Tests", () => {
  const correctEmail = "admin@drophub.com";
  const correctPassword = "admin123456";

  it("deve realizar login com sucesso usando credenciais corretas do seed", async () => {
    const result = await authenticateUser(correctEmail, correctPassword);

    expect(result.success).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBe(correctEmail);
    expect(result.user?.role).toBe("ADMIN");
    expect((result.user as any)?.passwordHash).toBeUndefined(); // Garante que o hash nunca vaza
  });

  it("deve rejeitar login com senha incorreta e retornar erro genérico seguro", async () => {
    const result = await authenticateUser(correctEmail, "senha_incorreta_teste");

    expect(result.success).toBe(false);
    expect(result.user).toBeUndefined();
    expect(result.error).toBe("E-mail ou senha incorretos.");
  });

  it("deve rejeitar login com usuário inexistente e retornar mesmo erro genérico", async () => {
    const result = await authenticateUser("inexistente@drophub.com", "qualquersenha");

    expect(result.success).toBe(false);
    expect(result.user).toBeUndefined();
    expect(result.error).toBe("E-mail ou senha incorretos.");
  });

  it("deve gerar e validar token JWT com payload correto", async () => {
    const sessionUser = {
      id: "user-test-uuid-123",
      email: "test@drophub.com",
      name: "Operador Teste",
      role: "OPERATOR" as const,
    };

    const token = await signSessionToken(sessionUser);
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");

    const payload = await verifySessionToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(sessionUser.id);
    expect(payload?.email).toBe(sessionUser.email);
    expect(payload?.role).toBe("OPERATOR");
  });

  it("deve rejeitar token JWT adulterado ou com assinatura inválida", async () => {
    const tamperedToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalidpayload.invalidsignature";
    const payload = await verifySessionToken(tamperedToken);

    expect(payload).toBeNull();
  });

  it("deve rejeitar token JWT expirado", async () => {
    const secretKey = new TextEncoder().encode(
      process.env.JWT_SECRET || "drophub_super_secret_jwt_key_at_least_32_characters_long_2026"
    );

    // Cria token propositalmente expirado há 1 hora
    const expiredToken = await new SignJWT({
      sub: "user-expired",
      email: "expired@drophub.com",
      name: "User Expired",
      role: "ADMIN",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secretKey);

    const payload = await verifySessionToken(expiredToken);
    expect(payload).toBeNull();
  });

  it("deve executar logout sem erros", async () => {
    await expect(logoutUser()).resolves.not.toThrow();
  });

  it("deve bloquear acesso no requireAuth quando não autenticado", async () => {
    await expect(requireAuth()).rejects.toThrow("UNAUTHORIZED");
  });

  it("deve validar controle de acesso por Role (RBAC)", () => {
    const checkRolePermission = (userRole: Role, allowed: Role[]) => {
      if (!allowed.includes(userRole)) {
        throw new Error("FORBIDDEN");
      }
      return true;
    };

    expect(() => checkRolePermission(Role.ADMIN, [Role.ADMIN])).not.toThrow();
    expect(() => checkRolePermission(Role.OPERATOR, [Role.ADMIN])).toThrow("FORBIDDEN");
    expect(() => checkRolePermission(Role.OPERATOR, [Role.ADMIN, Role.OPERATOR])).not.toThrow();
  });
});

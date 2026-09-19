import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

/**
 * Gera hash SHA-256 seguro a partir de um token bruto
 */
export function hashToken(rawToken: string): string {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Solicita recuperação de senha com proteção estrita contra enumeração de contas
 */
export async function requestPasswordReset(email: string): Promise<{
  success: boolean;
  message: string;
  devToken?: string;
}> {
  const normalizedEmail = email.toLowerCase().trim();

  // Verificar se o cliente existe no banco de dados
  const customer = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
  });

  // Gera token aleatório criptograficamente forte (256 bits)
  const rawToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Válido por 1 hora

  if (customer) {
    // Invalida tokens anteriores não utilizados para o mesmo e-mail
    await prisma.passwordResetToken.deleteMany({
      where: {
        email: normalizedEmail,
        usedAt: null,
      },
    });

    // Salva o novo token hasheado no banco
    await prisma.passwordResetToken.create({
      data: {
        email: normalizedEmail,
        tokenHash,
        expiresAt,
      },
    });
  }

  // Resposta idêntica independente da existência do e-mail (Anti-Enumeração)
  return {
    success: true,
    message: "Se o e-mail informado estiver cadastrado, as instruções de recuperação foram enviadas.",
    // Em desenvolvimento ou teste, disponibiliza token para verificação em scripts e testes
    ...(process.env.NODE_ENV !== "production" ? { devToken: rawToken } : {}),
  };
}

/**
 * Redefine a senha do usuário utilizando o token recebido
 */
export async function resetPasswordWithToken(
  rawToken: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  if (!rawToken || rawToken.length < 16) {
    throw new Error("INVALID_TOKEN");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("PASSWORD_TOO_SHORT");
  }

  const tokenHash = hashToken(rawToken);

  // Buscar token válido e não expirado
  const resetRecord = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
  });

  if (!resetRecord) {
    throw new Error("INVALID_TOKEN");
  }

  if (resetRecord.usedAt !== null) {
    throw new Error("TOKEN_ALREADY_USED");
  }

  if (resetRecord.expiresAt < new Date()) {
    throw new Error("TOKEN_EXPIRED");
  }

  const customer = await prisma.customer.findUnique({
    where: { email: resetRecord.email },
  });

  if (!customer) {
    throw new Error("CUSTOMER_NOT_FOUND");
  }

  // Hashear nova senha com bcrypt (10 rounds)
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  // Executar atualização atômica da senha e invalidação do token
  await prisma.$transaction([
    prisma.customer.update({
      where: { id: customer.id },
      data: { passwordHash: newPasswordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: resetRecord.id },
      data: { usedAt: new Date() },
    }),
  ]);

  return {
    success: true,
    message: "Sua senha foi redefinida com sucesso. Faça login com suas novas credenciais.",
  };
}

import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signSessionToken, setSessionCookie, clearSessionCookie, getSessionUser } from "./jwt";
import { SessionUser } from "@/types";
import { Role } from "@prisma/client";

export interface LoginResult {
  success: boolean;
  user?: SessionUser;
  error?: string;
}

/**
 * Autentica o usuário administrativo no banco de dados e define o cookie HTTP-Only seguro
 */
export async function authenticateUser(
  email: string,
  passwordPlain: string
): Promise<LoginResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Busca o usuário no banco de dados
  const user = await prisma.user.findUnique({
    where: { email: normalizedEmail },
  });

  // Mensagem genérica para não revelar existência do e-mail
  const genericErrorMessage = "E-mail ou senha incorretos.";

  if (!user) {
    return { success: false, error: genericErrorMessage };
  }

  // Compara a senha informada com o hash bcrypt
  const isPasswordValid = await bcrypt.compare(passwordPlain, user.passwordHash);
  if (!isPasswordValid) {
    return { success: false, error: genericErrorMessage };
  }

  const sessionUser: SessionUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  // Gera o token JWT seguro e armazena exclusivamente no cookie HTTP-Only
  const token = await signSessionToken(sessionUser);
  await setSessionCookie(token);

  return {
    success: true,
    user: sessionUser,
  };
}

/**
 * Realiza logout seguro removendo o cookie de sessão HTTP-Only
 */
export async function logoutUser(): Promise<void> {
  await clearSessionCookie();
}

/**
 * Obtém o usuário autenticado atual da requisição
 */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return await getSessionUser();
}

/**
 * Validação de autorização no servidor (Server Components e Server Actions)
 */
export async function requireAuth(allowedRoles: Role[] = [Role.ADMIN, Role.OPERATOR]): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHORIZED");
  }

  if (!allowedRoles.includes(user.role as Role)) {
    throw new Error("FORBIDDEN");
  }

  return user;
}

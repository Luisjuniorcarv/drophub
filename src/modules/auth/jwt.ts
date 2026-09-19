import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { SessionUser } from "@/types";

const JWT_SECRET = process.env.JWT_SECRET || "drophub_super_secret_jwt_key_at_least_32_characters_long_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "drophub_admin_session";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: "ADMIN" | "OPERATOR";
  iat?: number;
  exp?: number;
}

/**
 * Assina um JWT para o usuário da sessão
 */
export async function signSessionToken(user: SessionUser): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

/**
 * Valida e decodifica um token JWT
 */
export async function verifySessionToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as TokenPayload;
  } catch {
    return null;
  }
}

/**
 * Define o cookie de sessão exclusivamente via HTTP-Only, Secure e SameSite
 */
export async function setSessionCookie(token: string) {
  try {
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
  } catch {
    // Tratamento seguro para execuções fora de contexto HTTP (ex: testes automatizados)
  }
}

/**
 * Remove o cookie de sessão HTTP-Only (Logout)
 */
export async function clearSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(COOKIE_NAME);
  } catch {
    // Tratamento seguro para execuções fora de contexto HTTP
  }
}

/**
 * Obtém a sessão atual a partir do cookie HTTP-Only
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifySessionToken(token);
    if (!payload) return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

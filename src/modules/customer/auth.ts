import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET || "drophub_super_secret_jwt_key_at_least_32_characters_long_2026";
const CUSTOMER_COOKIE_NAME = "drophub_customer_session";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export interface CustomerSessionPayload {
  sub: string;
  email: string;
  name: string;
  role: "CUSTOMER";
  iat?: number;
  exp?: number;
}

export interface CustomerSessionUser {
  id: string;
  email: string;
  name: string;
  role: "CUSTOMER";
}

/**
 * Assina um JWT seguro para a sessão do cliente (Storefront)
 */
export async function signCustomerToken(user: { id: string; email: string; name: string }): Promise<string> {
  return new SignJWT({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: "CUSTOMER",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

/**
 * Valida e decodifica o JWT do cliente
 */
export async function verifyCustomerToken(token: string): Promise<CustomerSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return payload as unknown as CustomerSessionPayload;
  } catch {
    return null;
  }
}

/**
 * Define o cookie de sessão do cliente (HttpOnly, Secure, SameSite=Lax, 7 dias)
 */
export async function setCustomerSessionCookie(token: string) {
  try {
    const cookieStore = await cookies();
    const isProduction = process.env.NODE_ENV === "production";

    cookieStore.set(CUSTOMER_COOKIE_NAME, token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 dias
    });
  } catch {
    // Tratamento seguro em contexto fora do request HTTP
  }
}

/**
 * Remove o cookie de sessão do cliente (Logout)
 */
export async function clearCustomerSessionCookie() {
  try {
    const cookieStore = await cookies();
    cookieStore.delete(CUSTOMER_COOKIE_NAME);
  } catch {
    // Tratamento seguro
  }
}

/**
 * Obtém a sessão do cliente logado a partir do cookie HttpOnly
 */
export async function getCustomerSession(): Promise<CustomerSessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(CUSTOMER_COOKIE_NAME)?.value;
    if (!token) return null;

    const payload = await verifyCustomerToken(token);
    if (!payload || payload.role !== "CUSTOMER") return null;

    return {
      id: payload.sub,
      email: payload.email,
      name: payload.name,
      role: "CUSTOMER",
    };
  } catch {
    return null;
  }
}

/**
 * Exige autenticação de cliente. Lança exceção se não autenticado.
 */
export async function requireCustomerAuth(): Promise<CustomerSessionUser> {
  const customer = await getCustomerSession();
  if (!customer) {
    throw new Error("UNAUTHORIZED");
  }
  return customer;
}

/**
 * Registra um novo cliente com senha protegida por bcrypt
 */
export async function registerCustomer(data: {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  password: string;
}) {
  const normalizedEmail = data.email.toLowerCase().trim();
  const cleanCpf = data.cpf.replace(/\D/g, "");

  // Verificar se já existe cliente com mesmo email ou CPF
  const existingByEmail = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
  });
  if (existingByEmail) {
    if (existingByEmail.passwordHash) {
      throw new Error("EMAIL_ALREADY_EXISTS");
    }
    // Se o cliente foi criado em checkout como visitante e agora está cadastrando senha:
    const passwordHash = await bcrypt.hash(data.password, 10);
    const updated = await prisma.customer.update({
      where: { id: existingByEmail.id },
      data: {
        name: data.name.trim(),
        phone: data.phone.trim(),
        passwordHash,
      },
    });

    const token = await signCustomerToken({
      id: updated.id,
      email: updated.email,
      name: updated.name,
    });
    await setCustomerSessionCookie(token);

    return {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      cpf: updated.cpf,
    };
  }

  const existingByCpf = await prisma.customer.findUnique({
    where: { cpf: cleanCpf },
  });
  if (existingByCpf) {
    throw new Error("CPF_ALREADY_EXISTS");
  }

  const passwordHash = await bcrypt.hash(data.password, 10);

  const customer = await prisma.customer.create({
    data: {
      name: data.name.trim(),
      email: normalizedEmail,
      cpf: cleanCpf,
      phone: data.phone.trim(),
      passwordHash,
    },
  });

  const token = await signCustomerToken({
    id: customer.id,
    email: customer.email,
    name: customer.name,
  });
  await setCustomerSessionCookie(token);

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    cpf: customer.cpf,
  };
}

/**
 * Autentica cliente com email e senha. Mensagem genérica contra enumeração.
 */
export async function loginCustomer(credentials: { email: string; password: string }) {
  const normalizedEmail = credentials.email.toLowerCase().trim();

  const customer = await prisma.customer.findUnique({
    where: { email: normalizedEmail },
  });

  if (!customer || !customer.passwordHash) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const isPasswordValid = await bcrypt.compare(credentials.password, customer.passwordHash);
  if (!isPasswordValid) {
    throw new Error("INVALID_CREDENTIALS");
  }

  const token = await signCustomerToken({
    id: customer.id,
    email: customer.email,
    name: customer.name,
  });
  await setCustomerSessionCookie(token);

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    cpf: customer.cpf,
  };
}

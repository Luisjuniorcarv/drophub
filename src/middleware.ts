import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import {
  checkRateLimit,
  createRateLimitResponse,
  getClientIp,
  RATE_LIMIT_PRESETS,
} from "@/lib/rate-limit";

const JWT_SECRET = process.env.JWT_SECRET || "drophub_super_secret_jwt_key_at_least_32_characters_long_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "drophub_admin_session";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method;
  const ip = getClientIp(request);
  const bypassRateLimit = request.headers.get("x-bypass-rate-limit") === "true";

  // ----------------------------------------------------
  // 1. RATE LIMITING EM ROTAS CRÍTICAS (ANTI-ABUSO / DDOS)
  // ----------------------------------------------------
  if (!bypassRateLimit && process.env.NODE_ENV !== "test") {
    let rateLimitResult = null;

    if (
      (pathname === "/api/auth/login" || pathname === "/api/auth/customer/login") &&
      method === "POST"
    ) {
      rateLimitResult = checkRateLimit(`auth:${ip}`, RATE_LIMIT_PRESETS.AUTH);
    } else if (pathname === "/api/auth/forgot-password" && method === "POST") {
      rateLimitResult = checkRateLimit(`forgot-pw:${ip}`, RATE_LIMIT_PRESETS.FORGOT_PASSWORD);
    } else if (
      (pathname === "/api/checkout" ||
        pathname === "/api/checkout/payment" ||
        pathname === "/api/store/checkout") &&
      method === "POST"
    ) {
      rateLimitResult = checkRateLimit(`checkout:${ip}`, RATE_LIMIT_PRESETS.CHECKOUT);
    } else if (pathname.startsWith("/api/admin/ia") && method === "POST") {
      rateLimitResult = checkRateLimit(`ia:${ip}`, RATE_LIMIT_PRESETS.AI);
    }

    if (rateLimitResult && !rateLimitResult.success) {
      return createRateLimitResponse(rateLimitResult);
    }
  }

  // ----------------------------------------------------
  // 2. PROTEÇÃO CSRF: ORIGIN / REFERER EM MUTAÇÕES DE ESTADO
  // ----------------------------------------------------
  const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const isWebhookOrCron =
    pathname.startsWith("/api/webhooks") || pathname.startsWith("/api/cron");

  if (isMutatingMethod && !isWebhookOrCron) {
    const origin = request.headers.get("origin");
    const referer = request.headers.get("referer");
    const host = request.headers.get("host");

    if (origin && host) {
      try {
        const originUrl = new URL(origin);
        if (originUrl.host !== host) {
          return NextResponse.json(
            { error: "Requisição rejeitada por validação de segurança (Cross-Origin bloqueado)." },
            { status: 403 }
          );
        }
      } catch {
        return NextResponse.json({ error: "Origem da requisição inválida." }, { status: 403 });
      }
    }
  }

  // ----------------------------------------------------
  // 3. AUTENTICAÇÃO E AUTORIZAÇÃO ADMINISTRATIVA
  // ----------------------------------------------------
  const token = request.cookies.get(COOKIE_NAME)?.value;
  let isAuthenticated = false;
  let userPayload: any = null;

  if (token) {
    try {
      const { payload } = await jwtVerify(token, secretKey);
      if (payload.role === "ADMIN" || payload.role === "OPERATOR") {
        isAuthenticated = true;
        userPayload = payload;
      }
    } catch {
      isAuthenticated = false;
    }
  }

  // Proteger rotas da interface administrativa (/admin, /admin/*)
  if (pathname.startsWith("/admin")) {
    if (!isAuthenticated) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // Proteger endpoints de API administrativa (/api/admin/*)
  if (pathname.startsWith("/api/admin")) {
    if (!isAuthenticated) {
      return NextResponse.json(
        { error: "Acesso não autorizado. Autenticação administrativa requerida." },
        { status: 401 }
      );
    }
  }

  // Redirecionar usuário admin já autenticado ao acessar a página de login
  if (pathname === "/login") {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/admin", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/api/:path*",
    "/login",
  ],
};

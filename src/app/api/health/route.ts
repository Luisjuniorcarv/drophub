import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Healthcheck de Produção (Liveness & Readiness)
 * - GET /api/health -> Liveness (verificação rápida se o processo Node.js está respondendo)
 * - GET /api/health?type=readiness -> Readiness (validação de conectividade com o PostgreSQL)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");

  if (type === "readiness") {
    try {
      // Teste de conectividade com o PostgreSQL
      await prisma.$queryRaw`SELECT 1`;

      return NextResponse.json(
        {
          status: "ready",
          database: "connected",
          timestamp: new Date().toISOString(),
          service: "drophub-api",
          version: "1.0.0",
        },
        { status: 200 }
      );
    } catch (error: any) {
      console.error("[HEALTHCHECK_READINESS_FAILURE]", error);
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "disconnected",
          error: "Conexão com o banco de dados falhou",
          details: error.message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
  }

  // Liveness padrão
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "drophub-api",
      version: "1.0.0",
    },
    { status: 200 }
  );
}

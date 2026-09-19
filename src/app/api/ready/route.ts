import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Dedicated Readiness Probe for Kubernetes / EasyPanel / Load Balancers
 * GET /api/ready -> Validates PostgreSQL database connectivity
 */
export async function GET() {
  try {
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
    console.error("[READINESS_FAILURE]", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        error: "Conexão com o banco de dados falhou",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}

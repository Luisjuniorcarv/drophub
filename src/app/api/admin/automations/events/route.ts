import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const eventType = searchParams.get("eventType")?.trim();
    const entityType = searchParams.get("entityType")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (eventType && eventType !== "ALL") where.eventType = eventType;
    if (entityType && entityType !== "ALL") where.entityType = entityType;

    const [total, events, stats] = await Promise.all([
      prisma.outboxEvent.count({ where }),
      prisma.outboxEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          deliveries: {
            select: {
              id: true,
              webhookId: true,
              status: true,
              attemptNumber: true,
              statusCode: true,
              durationMs: true,
              deliveredAt: true,
              createdAt: true,
              webhook: { select: { name: true, url: true } },
            },
          },
        },
      }),
      prisma.outboxEvent.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const statusCounts = {
      PENDING: 0,
      PROCESSED: 0,
      FAILED: 0,
    };
    stats.forEach((s) => {
      if (s.status in statusCounts) {
        statusCounts[s.status as keyof typeof statusCounts] = s._count.id;
      }
    });

    return NextResponse.json({
      success: true,
      data: events,
      stats: statusCounts,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_OUTBOX_EVENTS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar eventos da outbox." }, { status: 500 });
  }
}

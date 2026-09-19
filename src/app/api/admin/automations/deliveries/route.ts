import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status")?.trim();
    const webhookId = searchParams.get("webhookId")?.trim();
    const eventId = searchParams.get("eventId")?.trim();
    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(50, Math.max(1, Number(searchParams.get("limit")) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (status && status !== "ALL") where.status = status;
    if (webhookId && webhookId !== "ALL") where.webhookId = webhookId;
    if (eventId) where.eventId = eventId;

    const [total, deliveries, stats] = await Promise.all([
      prisma.webhookDelivery.count({ where }),
      prisma.webhookDelivery.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          webhook: {
            select: { id: true, name: true, url: true },
          },
          event: {
            select: {
              id: true,
              eventType: true,
              entityType: true,
              entityId: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.webhookDelivery.groupBy({
        by: ["status"],
        _count: { id: true },
      }),
    ]);

    const statusCounts = {
      SUCCESS: 0,
      FAILED: 0,
    };
    stats.forEach((s) => {
      if (s.status in statusCounts) {
        statusCounts[s.status as keyof typeof statusCounts] = s._count.id;
      }
    });

    return NextResponse.json({
      success: true,
      data: deliveries,
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
    console.error("[API_WEBHOOK_DELIVERIES_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar histórico de entregas." }, { status: 500 });
  }
}

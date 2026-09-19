import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { WebhookUpdateSchema } from "@/lib/validators";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const webhook = await prisma.webhookEndpoint.findUnique({
      where: { id },
      include: {
        deliveries: {
          take: 20,
          orderBy: { createdAt: "desc" },
          include: {
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
        },
        _count: {
          select: { deliveries: true },
        },
      },
    });

    if (!webhook) {
      return NextResponse.json({ error: "Webhook não encontrado." }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: webhook });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_WEBHOOK_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao buscar webhook." }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Webhook não encontrado." }, { status: 404 });
    }

    const body = await req.json();
    const parseResult = WebhookUpdateSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados do webhook inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, url, secret, events, active, description } = parseResult.data;

    const updated = await prisma.webhookEndpoint.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(url !== undefined && { url }),
        ...(secret !== undefined && { secret: secret.trim() }),
        ...(events !== undefined && { events }),
        ...(active !== undefined && { active }),
        ...(description !== undefined && { description: description || null }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_WEBHOOK_PUT_ERROR]", error);
    return NextResponse.json({ error: "Erro ao atualizar webhook." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: Params) {
  try {
    await requireAuth();
    const { id } = await params;

    const existing = await prisma.webhookEndpoint.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Webhook não encontrado." }, { status: 404 });
    }

    await prisma.webhookEndpoint.delete({ where: { id } });

    return NextResponse.json({ success: true, message: "Webhook excluído com sucesso." });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_WEBHOOK_DELETE_ERROR]", error);
    return NextResponse.json({ error: "Erro ao excluir webhook." }, { status: 500 });
  }
}

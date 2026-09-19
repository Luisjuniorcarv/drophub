import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/modules/auth/service";
import { WebhookEndpointSchema } from "@/lib/validators";
import { generateWebhookSecret } from "@/modules/automations/hmac";

export async function GET(req: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search")?.trim();
    const active = searchParams.get("active");

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { url: { contains: search, mode: "insensitive" } },
      ];
    }
    if (active === "true") where.active = true;
    if (active === "false") where.active = false;

    const endpoints = await prisma.webhookEndpoint.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { deliveries: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: endpoints,
    });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_WEBHOOKS_GET_ERROR]", error);
    return NextResponse.json({ error: "Erro ao listar endpoints de webhook." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAuth();

    const body = await req.json();
    const parseResult = WebhookEndpointSchema.safeParse(body);

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: "Dados de webhook inválidos.",
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { name, url, secret, events, active, description } = parseResult.data;

    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        name,
        url,
        secret: secret && secret.trim() ? secret.trim() : generateWebhookSecret(),
        events,
        active: active ?? true,
        description: description || null,
      },
    });

    return NextResponse.json({ success: true, data: endpoint }, { status: 201 });
  } catch (error: any) {
    if (error.message === "UNAUTHORIZED" || error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "Acesso negado." }, { status: 401 });
    }
    console.error("[API_WEBHOOKS_POST_ERROR]", error);
    return NextResponse.json({ error: "Erro ao criar endpoint de webhook." }, { status: 500 });
  }
}

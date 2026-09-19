import { prisma } from "@/lib/prisma";
import { OrderStatus, FulfillmentStatus, AutomationStatus } from "@prisma/client";
import { AIProvider } from "../provider";
import { buildOperationsAssistantPrompt } from "../prompts/operations";
import { AIResponse } from "../types";

export class OperationsAssistant {
  constructor(private provider: AIProvider) {}

  async analyze(params: {
    focusArea?: "ALL" | "STOCK" | "ORDERS" | "FULFILLMENT" | "SUPPLIERS";
    prompt: string;
    userId?: string;
  }): Promise<AIResponse> {
    const now = Date.now();
    const twentyFourHoursAgo = new Date(now - 24 * 60 * 60 * 1000);

    const [
      lowStockProducts,
      openOrders,
      pendingFulfillmentsCount,
      failedFulfillmentsCount,
      failedAutomationsCount,
    ] = await Promise.all([
      prisma.product.findMany({
        where: { stock: { lte: 5 }, active: true },
        select: { sku: true, name: true, stock: true },
        take: 10,
        orderBy: { stock: "asc" },
      }),
      prisma.order.findMany({
        where: {
          status: {
            in: [
              OrderStatus.AWAITING_SUPPLIER,
              OrderStatus.SENT_TO_SUPPLIER,
              OrderStatus.PROCESSING,
              OrderStatus.AWAITING_PAYMENT,
            ],
          },
          createdAt: { lte: twentyFourHoursAgo },
        },
        select: {
          orderNumber: true,
          status: true,
          createdAt: true,
          totalAmount: true,
        },
        take: 10,
        orderBy: { createdAt: "asc" },
      }),
      prisma.fulfillmentOrder.count({
        where: { status: FulfillmentStatus.PENDING },
      }),
      prisma.fulfillmentOrder.count({
        where: { status: FulfillmentStatus.FAILED },
      }),
      prisma.outboxEvent.count({
        where: { status: AutomationStatus.FAILED },
      }),
    ]);

    const stuckOrders = openOrders.map((o) => ({
      orderNumber: o.orderNumber,
      status: o.status,
      hoursSinceCreated: (now - new Date(o.createdAt).getTime()) / (1000 * 60 * 60),
      totalAmount: Number(o.totalAmount),
    }));

    const systemPrompt = buildOperationsAssistantPrompt({
      operationalData: {
        lowStockSkus: lowStockProducts,
        stuckOrders,
        pendingFulfillmentsCount,
        failedFulfillmentsCount,
        failedAutomationsCount,
      },
      userPrompt: params.prompt,
    });

    return await this.provider.generateText({
      assistant: "OPERATIONS",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      userId: params.userId,
    });
  }
}

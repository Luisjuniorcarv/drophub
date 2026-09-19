import { prisma } from "@/lib/prisma";
import { AIProvider } from "../provider";
import { buildCustomerAssistantPrompt } from "../prompts/customer";
import { AIResponse } from "../types";

export class CustomerAssistant {
  constructor(private provider: AIProvider) {}

  async analyze(params: {
    customerId: string;
    prompt: string;
    userId?: string;
  }): Promise<AIResponse> {
    const customer = await prisma.customer.findUnique({
      where: { id: params.customerId },
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            status: true,
            totalAmount: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!customer) {
      throw new Error(`CUSTOMER_NOT_FOUND: Cliente com ID ${params.customerId} não localizado.`);
    }

    const totalOrders = customer.orders.length;
    const totalSpent = customer.orders.reduce((acc, o) => acc + Number(o.totalAmount), 0);
    const averageTicket = totalOrders > 0 ? totalSpent / totalOrders : 0;
    const lastOrderDate = customer.orders[0]?.createdAt
      ? new Date(customer.orders[0].createdAt).toLocaleDateString("pt-BR")
      : undefined;

    const statusesBreakdown: Record<string, number> = {};
    for (const order of customer.orders) {
      statusesBreakdown[order.status] = (statusesBreakdown[order.status] || 0) + 1;
    }

    const systemPrompt = buildCustomerAssistantPrompt({
      customerSummary: {
        name: customer.name,
        email: customer.email,
        totalOrders,
        totalSpent,
        averageTicket,
        lastOrderDate,
        statusesBreakdown,
      },
      userPrompt: params.prompt,
    });

    return await this.provider.generateText({
      assistant: "CUSTOMER",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      userId: params.userId,
    });
  }
}

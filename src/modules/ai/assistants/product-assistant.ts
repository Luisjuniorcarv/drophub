import { prisma } from "@/lib/prisma";
import { AIProvider } from "../provider";
import { buildProductAssistantPrompt } from "../prompts/product";
import { AIResponse } from "../types";

export class ProductAssistant {
  constructor(private provider: AIProvider) {}

  async analyze(params: {
    productId?: string;
    title?: string;
    description?: string;
    category?: string;
    prompt: string;
    targetMarketplace?: string;
    userId?: string;
  }): Promise<AIResponse> {
    let productData: any = undefined;

    if (params.productId) {
      const dbProduct = await prisma.product.findUnique({
        where: { id: params.productId },
        include: { category: true },
      });

      if (dbProduct) {
        productData = {
          name: dbProduct.name,
          description: dbProduct.description,
          category: dbProduct.category?.name || "Geral",
          costPrice: Number(dbProduct.costPrice),
          sellingPrice: Number(dbProduct.sellingPrice),
          stock: dbProduct.stock,
          sku: dbProduct.sku,
        };
      }
    } else if (params.title) {
      productData = {
        name: params.title,
        description: params.description || "",
        category: params.category || "Geral",
      };
    }

    const systemPrompt = buildProductAssistantPrompt({
      productData,
      userPrompt: params.prompt,
      targetMarketplace: params.targetMarketplace,
    });

    return await this.provider.generateText({
      assistant: "PRODUCT",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      userId: params.userId,
    });
  }
}

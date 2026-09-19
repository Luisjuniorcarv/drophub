import { getFinancialDRE } from "@/modules/finance/service";
import { PeriodType } from "@/modules/finance/types";
import { AIProvider } from "../provider";
import { buildFinancialAssistantPrompt } from "../prompts/financial";
import { AIResponse } from "../types";

export class FinancialAssistant {
  constructor(private provider: AIProvider) {}

  async analyze(params: {
    period?: PeriodType;
    startDate?: string;
    endDate?: string;
    prompt: string;
    userId?: string;
  }): Promise<AIResponse> {
    const period = params.period || "30d";
    const dre = await getFinancialDRE(period, params.startDate, params.endDate);

    const systemPrompt = buildFinancialAssistantPrompt({
      dre,
      userPrompt: params.prompt,
    });

    return await this.provider.generateText({
      assistant: "FINANCIAL",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: params.prompt },
      ],
      userId: params.userId,
    });
  }
}

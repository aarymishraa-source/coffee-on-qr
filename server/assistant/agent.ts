import "server-only";
import { z } from "zod";
import { createAgent, tool, toolStrategy } from "langchain";
import { AIMessage, HumanMessage, type BaseMessage } from "@langchain/core/messages";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import {
  escalateToExpert, getActiveOrder, getFarmerProfile, getHarvestPlan, getLatestCropAnalysis, getPaymentStatus,
  respondToActiveOffer, searchAgriKnowledge, type AssistantContext,
} from "./business-tools";
import { assistantSystemPrompt } from "./prompts";
import { assistantReplySchema, type AssistantReply } from "./schemas";

// LangChain agent: the model decides which business tool to call; the tools
// read and write real records. Output is a Zod-validated structured reply.

export interface AgentResult extends AssistantReply {
  actions: { tool: string; result: unknown }[];
}

function buildTools(ctx: AssistantContext, actions: AgentResult["actions"]) {
  const json = (v: unknown) => JSON.stringify(v);
  const record = <T,>(name: string, result: T) => {
    actions.push({ tool: name, result });
    return json(result);
  };
  return [
    tool(async () => json(await getFarmerProfile(ctx)), {
      name: "getFarmerProfile",
      description: "The farmer's verified profile: village, language, FPO, field agent, crops with stage and expected harvest.",
      schema: z.object({}),
    }),
    tool(async () => json(await getActiveOrder(ctx)), {
      name: "getActiveOrder",
      description: "Open café orders sent to this farmer's FPO for crops they grow, with total, open and their committed kg.",
      schema: z.object({}),
    }),
    tool(async (input) => record("respondToOffer", await respondToActiveOffer(ctx, input)), {
      name: "respondToOffer",
      description:
        "Record the farmer's answer to an open order. action=accept supplies all open kg; action=commit with quantityKg supplies part; action=decline declines. Only call when the farmer clearly answered.",
      schema: z.object({
        offerId: z.string().optional(),
        action: z.enum(["accept", "commit", "decline"]),
        quantityKg: z.number().optional().describe("Kilograms, greater than 0. Required for action=commit."),
      }),
    }),
    tool(async () => json(await getHarvestPlan(ctx)), {
      name: "getHarvestPlan",
      description: "Expected harvest dates and quantities, and current supply commitments.",
      schema: z.object({}),
    }),
    tool(async () => json(await getPaymentStatus(ctx)), {
      name: "getPaymentStatus",
      description: "Payment and payout status for the farmer's delivered orders. 'simulated' means no money moved.",
      schema: z.object({}),
    }),
    tool(async () => json(await getLatestCropAnalysis(ctx)), {
      name: "getCropAnalysis",
      description: "The stored result of the farmer's most recent crop photo analysis, for follow-up questions.",
      schema: z.object({}),
    }),
    tool(async ({ query, crop }) => json(searchAgriKnowledge(ctx, query, crop)), {
      name: "searchAgriKnowledge",
      description: "Search the curated, general crop-care notes. Use only these for agricultural advice and cite the source.",
      schema: z.object({ query: z.string(), crop: z.string().optional() }),
    }),
    tool(async ({ reason }) => record("escalateToExpert", await escalateToExpert(ctx, reason)), {
      name: "escalateToExpert",
      description: "Ask the farmer's field agent to arrange a human agriculture expert review.",
      schema: z.object({ reason: z.string() }),
    }),
  ];
}

/** A model call that hangs longer than this falls back to the demo assistant. */
export const AGENT_TIMEOUT_MS = 45_000;

export async function runAssistantAgent(
  ctx: AssistantContext,
  model: BaseChatModel,
  history: BaseMessage[],
  text: string,
  farmerName: string,
  opts: { timeoutMs?: number } = {}
): Promise<AgentResult> {
  const actions: AgentResult["actions"] = [];
  const agent = createAgent({
    model,
    tools: buildTools(ctx, actions),
    systemPrompt: assistantSystemPrompt({
      farmerName,
      language: ctx.language,
      today: new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" }),
    }),
    // The final answer is returned through a tool call rather than the
    // provider's JSON mode: Gemini 2.x can't combine JSON mode with tools.
    responseFormat: toolStrategy(assistantReplySchema),
  });
  const res = await agent.invoke(
    { messages: [...history, new HumanMessage(text)] },
    { recursionLimit: 12, signal: AbortSignal.timeout(opts.timeoutMs ?? AGENT_TIMEOUT_MS) }
  );
  const parsed = assistantReplySchema.parse(res.structuredResponse);
  if (!parsed.reply.trim()) throw new Error("Model returned an empty reply");
  return { ...parsed, actions };
}

export function toHistory(messages: { direction: "IN" | "OUT"; body: string; type: string }[]): BaseMessage[] {
  return messages.map((m) =>
    m.direction === "IN" ? new HumanMessage(m.body) : new AIMessage(m.type === "OFFER" ? `[Order card] ${m.body}` : m.body)
  );
}

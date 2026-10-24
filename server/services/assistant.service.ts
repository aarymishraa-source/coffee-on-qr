import "server-only";
import { z } from "zod";
import type { Db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess } from "@/server/auth/access";
import { getChatModel } from "@/server/integrations/langchain/model";
import { runAssistantAgent, toHistory } from "@/server/assistant/agent";
import { fallbackReply } from "@/server/assistant/fallback";
import type { AssistantContext } from "@/server/assistant/business-tools";
import { T, type Lang } from "./i18n";
import { postMessage } from "./conversation.service";

export const sendMessageSchema = z.object({
  farmerId: z.string().min(1),
  text: z.string().trim().min(1).max(2000),
  clientKey: z.string().min(8).max(200),
});

export interface InboundInput {
  farmerId: string;
  text: string;
  source: "CHAT" | "VOICE" | "WHATSAPP";
  clientKey?: string | null; // portal idempotency key
  providerMessageId?: string | null; // WhatsApp message id (dedupe)
  type?: "TEXT" | "AUDIO";
  mediaId?: string | null;
  payload?: Record<string, unknown>;
  channel?: "PORTAL" | "WHATSAPP";
}

/** A pseudo-actor for a farmer reaching us over WhatsApp (no portal session). */
export async function farmerActor(db: Db, farmerId: string): Promise<Actor> {
  const f = await db.farmer.findUniqueOrThrow({ where: { id: farmerId } });
  return { id: null, name: f.name, role: "FARMER", isDemo: f.isDemo, cafeId: null, fpoId: f.fpoId, farmerId: f.id, fieldAgentId: null };
}

/**
 * Stores a farmer's message and replies. Uses the LangChain agent when a model
 * key is configured, otherwise the deterministic fallback (replies flagged
 * isDemoReply → "Demo reply" in the UI). Duplicate deliveries are ignored.
 */
export async function handleFarmerMessage(db: Db, actor: Actor, input: InboundInput) {
  await assertFarmerAccess(db, actor, input.farmerId);
  if (input.clientKey) {
    const dup = await db.message.findUnique({ where: { clientKey: input.clientKey } });
    if (dup) return { inbound: dup, reply: null, duplicate: true };
  }
  if (input.providerMessageId) {
    const dup = await db.message.findUnique({ where: { providerMessageId: input.providerMessageId } });
    if (dup) return { inbound: dup, reply: null, duplicate: true };
  }

  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
  const conv = await db.conversation.findUnique({ where: { farmerId: farmer.id } });
  const history = conv
    ? await db.message.findMany({ where: { conversationId: conv.id }, orderBy: { createdAt: "desc" }, take: 16 })
    : [];

  const inbound = await postMessage(db, {
    farmerId: farmer.id,
    direction: "IN",
    author: "FARMER",
    type: input.type ?? "TEXT",
    body: input.text,
    clientKey: input.clientKey,
    providerMessageId: input.providerMessageId,
    sentByUserId: actor.role === "FARMER" || !actor.id ? null : actor.id,
    mediaId: input.mediaId,
    payload: input.payload as never,
    channel: input.channel,
  });

  const lang = farmer.language as Lang;
  const ctx: AssistantContext = {
    db,
    actor,
    farmerId: farmer.id,
    language: lang,
    source: input.source,
    requestKey: inbound.id,
  };

  let text: string;
  let isDemoReply = false;
  let note: string | undefined;
  const llm = await getChatModel();
  if (llm) {
    try {
      const r = await runAssistantAgent(ctx, llm.model, toHistory(history.reverse()), input.text, farmer.name);
      text = r.reply;
      if (lang !== "en" && r.farmer_message_english) {
        await db.message.update({ where: { id: inbound.id }, data: { translation: r.farmer_message_english } });
      }
    } catch (err) {
      logger.warn("assistant: model call failed, using fallback", { error: err instanceof Error ? err.message : String(err) });
      text = (await fallbackReply(ctx, input.text)).reply;
      isDemoReply = true;
      note = "model_error";
    }
  } else {
    text = (await fallbackReply(ctx, input.text)).reply;
    isDemoReply = true;
    note = "no_model_key";
  }

  const reply = await postMessage(db, {
    farmerId: farmer.id,
    direction: "OUT",
    author: "ASSISTANT",
    body: text || T.dontKnow(lang),
    isDemoReply,
    payload: note ? { fallback: note } : undefined,
  });
  return { inbound, reply, duplicate: false };
}

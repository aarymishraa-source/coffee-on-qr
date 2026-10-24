import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { logger } from "@/lib/logger";
import { isConfigured } from "@/lib/env";
import { T, ingredientName, type Lang } from "./i18n";
import { sendWhatsAppText } from "./whatsapp.service";

type MessageType = "TEXT" | "IMAGE" | "AUDIO" | "OFFER" | "CROP_ANALYSIS" | "BATCH" | "PAYMENT";

export interface PostMessageInput {
  farmerId: string;
  direction: "IN" | "OUT";
  author: "FARMER" | "ASSISTANT" | "STAFF" | "SYSTEM";
  type?: MessageType;
  body: string;
  translation?: string | null;
  payload?: Prisma.InputJsonValue;
  isDemoReply?: boolean;
  sentByUserId?: string | null;
  clientKey?: string | null;
  mediaId?: string | null;
  channel?: "PORTAL" | "WHATSAPP";
  providerMessageId?: string | null;
}

export async function getOrCreateConversation(db: Db, farmerId: string) {
  return db.conversation.upsert({ where: { farmerId }, update: {}, create: { farmerId } });
}

/**
 * Persists a message. Outbound messages go to the farmer over WhatsApp only
 * when WhatsApp is configured; otherwise they stay in the portal (shown with
 * a "Demo conversation" chip) and are never marked as WhatsApp-delivered.
 */
export async function postMessage(db: Db, input: PostMessageInput) {
  if (input.clientKey) {
    const existing = await db.message.findUnique({ where: { clientKey: input.clientKey } });
    if (existing) return existing;
  }
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
  const conv = await getOrCreateConversation(db, farmer.id);

  const viaWhatsApp = input.direction === "OUT" && isConfigured.whatsapp() && farmer.contactPreference === "WHATSAPP";
  const message = await db.message.create({
    data: {
      conversationId: conv.id,
      direction: input.direction,
      author: input.author,
      type: input.type ?? "TEXT",
      body: input.body,
      translation: input.translation ?? null,
      language: farmer.language,
      payload: input.payload,
      status: viaWhatsApp ? "PENDING" : "SENT",
      channel: input.channel ?? (viaWhatsApp ? "WHATSAPP" : "PORTAL"),
      isDemoReply: input.isDemoReply ?? false,
      sentByUserId: input.sentByUserId ?? null,
      clientKey: input.clientKey ?? null,
      mediaId: input.mediaId ?? null,
      providerMessageId: input.providerMessageId ?? null,
    },
  });
  await db.conversation.update({
    where: { id: conv.id },
    data: { lastMessageAt: message.createdAt, ...(input.direction === "IN" ? { unreadCount: { increment: 1 } } : {}) },
  });

  if (viaWhatsApp) {
    try {
      const sent = await sendWhatsAppText(farmer.phone, input.body);
      return db.message.update({ where: { id: message.id }, data: { status: "SENT", providerMessageId: sent.id } });
    } catch (err) {
      logger.warn("whatsapp: outbound send failed", { messageId: message.id, error: err instanceof Error ? err.message : String(err) });
      return db.message.update({ where: { id: message.id }, data: { status: "FAILED" } });
    }
  }
  return message;
}

export function offerCardText(
  lang: Lang,
  ingredient: { name: string; nameHi: string | null; nameMr: string | null },
  quantity: number,
  pricePerKg: number
) {
  return T.offer(lang, ingredientName(lang, ingredient), quantity, pricePerKg);
}

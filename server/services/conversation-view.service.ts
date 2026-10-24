import "server-only";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess, farmerScope } from "@/server/auth/access";
import { getFarmerOffers } from "./order.service";

/** Conversation list for the chat sidebar, scoped to what the actor may see. */
export async function listConversations(db: Db, actor: Actor) {
  const farmers = await db.farmer.findMany({
    where: farmerScope(actor),
    include: {
      conversation: { include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
      crops: true,
      cropImages: { take: 1, orderBy: { createdAt: "desc" } },
    },
  });
  const openOffers = await db.demandOffer.findMany({
    where: { status: { in: ["OFFERED", "PARTIALLY_COMMITTED"] } },
    select: { ingredientId: true, fpoId: true },
  });
  return farmers
    .map((f) => {
      const last = f.conversation?.messages[0];
      const hasOrder = openOffers.some((o) => o.fpoId === f.fpoId && f.crops.some((c) => c.crop === o.ingredientId && c.stage !== "SOWING"));
      return {
        farmerId: f.id,
        name: f.name,
        village: f.village,
        language: f.language,
        lastMessage: last ? { body: last.body, type: last.type, direction: last.direction, at: last.createdAt.toISOString(), status: last.status } : null,
        lastAt: (f.conversation?.lastMessageAt ?? f.createdAt).toISOString(),
        unread: f.conversation?.unreadCount ?? 0,
        tags: { order: hasOrder, cropHelp: f.cropImages.length > 0 },
      };
    })
    .sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/** One conversation: farmer context panel data + messages. */
export async function getConversation(db: Db, actor: Actor, farmerId: string) {
  await assertFarmerAccess(db, actor, farmerId);
  const farmer = await db.farmer.findUniqueOrThrow({
    where: { id: farmerId },
    include: { crops: true, fpo: true, fieldAgent: true, conversation: true },
  });
  const [messages, offers, ingredients, analyses] = await Promise.all([
    farmer.conversation
      ? db.message.findMany({ where: { conversationId: farmer.conversation.id }, orderBy: { createdAt: "asc" }, take: 200 })
      : Promise.resolve([]),
    getFarmerOffers(db, farmerId),
    db.ingredient.findMany({ select: { id: true, name: true, nameHi: true, nameMr: true } }),
    db.cropAnalysis.findMany({ where: { farmerId }, select: { id: true, expertRequestedAt: true } }),
  ]);
  const expert = new Map(analyses.map((a) => [a.id, a.expertRequestedAt?.toISOString() ?? null]));
  return {
    farmer: {
      id: farmer.id,
      name: farmer.name,
      phone: farmer.phone,
      village: farmer.village,
      district: farmer.district,
      language: farmer.language,
      fpo: farmer.fpo?.name ?? null,
      fieldAgent: farmer.fieldAgent?.name ?? null,
      areaAcres: farmer.areaAcres,
      lat: farmer.lat,
      lng: farmer.lng,
      contactPreference: farmer.contactPreference,
      crops: farmer.crops.map((c) => ({
        crop: c.crop,
        name: ingredients.find((i) => i.id === c.crop)?.name ?? c.crop,
        stage: c.stage,
        expectedHarvestDate: c.expectedHarvestDate?.toISOString() ?? null,
        expectedQtyKg: c.expectedQtyKg,
      })),
    },
    offers,
    messages: messages.map((m) => {
      const p = (m.payload ?? {}) as Record<string, unknown>;
      return {
        id: m.id,
        direction: m.direction,
        author: m.author,
        type: m.type,
        body: m.body,
        translation: m.translation,
        status: m.status,
        channel: m.channel,
        isDemoReply: m.isDemoReply,
        agentAssisted: Boolean(m.sentByUserId),
        mediaUrl: m.mediaId ? `/api/media/${m.mediaId}` : null,
        payload: p,
        expertRequestedAt: typeof p.analysisId === "string" ? (expert.get(p.analysisId) ?? null) : null,
        createdAt: m.createdAt.toISOString(),
      };
    }),
  };
}

export async function markRead(db: Db, actor: Actor, farmerId: string) {
  await assertFarmerAccess(db, actor, farmerId);
  await db.conversation.updateMany({ where: { farmerId }, data: { unreadCount: 0 } });
}

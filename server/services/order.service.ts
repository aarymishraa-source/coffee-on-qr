import "server-only";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess } from "@/server/auth/access";
import { audit } from "./audit.service";
import { T, ingredientName, type Lang } from "./i18n";
import { postMessage } from "./conversation.service";

// The primary business workflow: a farmer answers an offer. Every answer
// updates the SAME offer and at most one commitment per farmer, inside a
// transaction that locks the offer row, so repeated replies or webhook
// retries can never create duplicates or over-commit.

export const respondSchema = z.object({
  offerId: z.string().min(1),
  farmerId: z.string().min(1),
  action: z.enum(["accept", "commit", "decline"]),
  quantity: z.number().positive().max(100_000).optional(),
  source: z.enum(["CHAT", "VOICE", "WHATSAPP", "CONSOLE"]).default("CHAT"),
  idempotencyKey: z.string().min(8).max(200).optional(),
});
export type RespondInput = z.infer<typeof respondSchema>;

export type RespondOutcome =
  | { kind: "committed"; quantity: number; open: number; offerStatus: string }
  | { kind: "declined"; open: number; offerStatus: string }
  | { kind: "exceeds"; open: number }
  | { kind: "closed" }
  | { kind: "duplicate"; open: number; offerStatus: string };

const round2 = (n: number) => Math.round(n * 100) / 100;

export function statusFor(quantity: number, committed: number) {
  if (committed >= quantity - 1e-9) return "ACCEPTED" as const;
  if (committed > 0) return "PARTIALLY_COMMITTED" as const;
  return "OFFERED" as const;
}

export async function respondToOffer(db: Db, actor: Actor, input: RespondInput) {
  await assertFarmerAccess(db, actor, input.farmerId);

  const outcome = await db.$transaction(async (tx): Promise<RespondOutcome> => {
    if (input.idempotencyKey) {
      const seen = await tx.webhookEvent.findUnique({
        where: { provider_eventId: { provider: "offer-response", eventId: input.idempotencyKey } },
      });
      if (seen) {
        const o = await tx.demandOffer.findUniqueOrThrow({ where: { id: input.offerId }, include: { commitments: true } });
        return { kind: "duplicate", open: openOf(o), offerStatus: o.status };
      }
      await tx.webhookEvent.create({
        data: { provider: "offer-response", eventId: input.idempotencyKey, payload: input as unknown as Prisma.InputJsonValue, processedAt: new Date() },
      });
    }

    // Serialise concurrent answers to the same offer.
    await tx.$queryRawUnsafe(`SELECT id FROM "DemandOffer" WHERE id = $1 FOR UPDATE`, input.offerId);
    const offer = await tx.demandOffer.findUnique({ where: { id: input.offerId }, include: { commitments: true } });
    if (!offer) throw new ApiError(404, "not_found", "Offer not found.");
    const farmer = await tx.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
    if (farmer.fpoId !== offer.fpoId) throw new ApiError(403, "forbidden", "This offer was sent to a different FPO.");

    const mine = offer.commitments.find((c) => c.farmerId === input.farmerId);
    const othersCommitted = offer.commitments
      .filter((c) => c.farmerId !== input.farmerId && c.status === "COMMITTED")
      .reduce((a, c) => a + c.quantity, 0);
    const available = round2(offer.quantity - othersCommitted);

    if (!["OFFERED", "PARTIALLY_COMMITTED", "ACCEPTED"].includes(offer.status)) return { kind: "closed" };
    if (input.action !== "decline" && available <= 0) return { kind: "closed" };

    let quantity = 0;
    let status: "COMMITTED" | "DECLINED" = "DECLINED";
    if (input.action === "accept") {
      quantity = available;
      status = "COMMITTED";
    } else if (input.action === "commit") {
      if (!input.quantity) throw new ApiError(400, "quantity_required", "Say how many kg.");
      if (input.quantity > available + 1e-9) return { kind: "exceeds", open: available };
      quantity = round2(input.quantity);
      status = "COMMITTED";
    }

    const data = { quantity, status, source: input.source };
    if (mine) await tx.farmerCommitment.update({ where: { id: mine.id }, data });
    else await tx.farmerCommitment.create({ data: { ...data, offerId: offer.id, farmerId: farmer.id } });

    const committed = round2(othersCommitted + (status === "COMMITTED" ? quantity : 0));
    const offerStatus = statusFor(offer.quantity, committed);
    await tx.demandOffer.update({ where: { id: offer.id }, data: { status: offerStatus } });
    await audit(tx, { ...actor, name: actor.role === "FARMER" ? actor.name : `${farmer.name} (via ${actor.name})` },
      status === "COMMITTED" ? "commitment.saved" : "commitment.declined", "DemandOffer", offer.id, {
        farmer: farmer.name, quantity, open: round2(offer.quantity - committed), source: input.source,
      });
    const open = round2(offer.quantity - committed);
    return status === "COMMITTED"
      ? { kind: "committed", quantity, open, offerStatus }
      : { kind: "declined", open, offerStatus };
  });

  return outcome;
}

function openOf(o: { quantity: number; commitments: { status: string; quantity: number }[] }) {
  return round2(o.quantity - o.commitments.filter((c) => c.status === "COMMITTED").reduce((a, c) => a + c.quantity, 0));
}

/** The confirmation text a farmer sees for an outcome, in their language. */
export function outcomeText(lang: Lang, ing: { name: string; nameHi: string | null; nameMr: string | null }, o: RespondOutcome) {
  const name = ingredientName(lang, ing);
  switch (o.kind) {
    case "committed":
      return T.committed(lang, name, o.quantity, o.open);
    case "declined":
      return T.declined(lang);
    case "exceeds":
      return T.exceeds(lang, o.open);
    case "closed":
      return T.closed(lang);
    case "duplicate":
      return null;
  }
}

/** Respond + post the farmer's reply and the confirmation into the conversation. */
export async function respondFromChat(
  db: Db,
  actor: Actor,
  input: RespondInput & { replyText?: string }
) {
  const offer = await db.demandOffer.findUnique({ where: { id: input.offerId }, include: { ingredient: true } });
  if (!offer) throw new ApiError(404, "not_found", "Offer not found.");
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
  const outcome = await respondToOffer(db, actor, input);
  if (outcome.kind === "duplicate") return { outcome };

  if (input.replyText) {
    await postMessage(db, {
      farmerId: farmer.id,
      direction: "IN",
      author: "FARMER",
      body: input.replyText,
      sentByUserId: actor.role === "FARMER" ? null : actor.id,
      clientKey: input.idempotencyKey ? `reply:${input.idempotencyKey}` : null,
    });
  }
  const text = outcomeText(farmer.language, offer.ingredient, outcome);
  if (text) {
    await postMessage(db, {
      farmerId: farmer.id,
      direction: "OUT",
      author: "SYSTEM",
      body: text,
      payload: { offerId: offer.id, outcome: outcome.kind },
    });
  }
  return { outcome };
}

/** Offers visible to a farmer, with how much is still open and what they've committed. */
export async function getFarmerOffers(db: Db, farmerId: string) {
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: farmerId }, include: { crops: true } });
  const offers = await db.demandOffer.findMany({
    where: { fpoId: farmer.fpoId ?? "__none__", status: { in: ["OFFERED", "PARTIALLY_COMMITTED", "ACCEPTED"] } },
    include: { ingredient: true, commitments: true },
    orderBy: { createdAt: "desc" },
  });
  return offers
    .filter((o) => farmer.crops.some((c) => c.crop === o.ingredientId) || o.commitments.some((c) => c.farmerId === farmerId))
    .map((o) => ({
      id: o.id,
      ingredientId: o.ingredientId,
      ingredient: o.ingredient.name,
      quantity: o.quantity,
      pricePerKg: o.pricePerKg,
      status: o.status,
      neededBy: o.neededBy.toISOString(),
      open: openOf(o),
      mine: o.commitments.find((c) => c.farmerId === farmerId) ?? null,
    }));
}

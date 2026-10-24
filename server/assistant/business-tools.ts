import "server-only";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/auth/types";
import { audit } from "@/server/services/audit.service";
import { getFarmerOffers, respondToOffer, outcomeText } from "@/server/services/order.service";
import { T, ingredientName, type Lang } from "@/server/services/i18n";
import { searchKnowledge } from "./knowledge";

// Plain business functions behind the assistant's tools. The LangChain agent
// and the no-key fallback both call these, so answers always come from
// stored records — never from the model's imagination.

export interface AssistantContext {
  db: Db;
  actor: Actor;
  farmerId: string;
  language: Lang;
  source: "CHAT" | "VOICE" | "WHATSAPP";
  /** Idempotency seed (e.g. the inbound message id) so retries never double-commit. */
  requestKey: string;
}

export async function getFarmerProfile(ctx: AssistantContext) {
  const f = await ctx.db.farmer.findUniqueOrThrow({
    where: { id: ctx.farmerId },
    include: { crops: true, fpo: true, fieldAgent: true },
  });
  return {
    name: f.name,
    village: f.village,
    district: f.district,
    language: f.language,
    fpo: f.fpo?.name ?? null,
    fieldAgent: f.fieldAgent?.name ?? null,
    areaAcres: f.areaAcres,
    crops: f.crops.map((c) => ({
      crop: c.crop,
      stage: c.stage,
      expectedHarvestDate: c.expectedHarvestDate?.toISOString().slice(0, 10) ?? null,
      expectedQtyKg: c.expectedQtyKg,
    })),
  };
}

export async function getActiveOrder(ctx: AssistantContext) {
  const offers = await getFarmerOffers(ctx.db, ctx.farmerId);
  return offers.map((o) => ({
    offerId: o.id,
    ingredient: o.ingredient,
    totalKg: o.quantity,
    openKg: o.open,
    pricePerKg: o.pricePerKg,
    neededBy: o.neededBy.slice(0, 10),
    status: o.status,
    yourCommitmentKg: o.mine?.status === "COMMITTED" ? o.mine.quantity : 0,
  }));
}

export async function respondToActiveOffer(
  ctx: AssistantContext,
  input: { offerId?: string; action: "accept" | "commit" | "decline"; quantityKg?: number }
) {
  const offers = await getFarmerOffers(ctx.db, ctx.farmerId);
  const offer = input.offerId ? offers.find((o) => o.id === input.offerId) : offers.find((o) => o.open > 0) ?? offers[0];
  if (!offer) return { ok: false as const, message: T.noActiveOrder(ctx.language) };
  const outcome = await respondToOffer(ctx.db, ctx.actor, {
    offerId: offer.id,
    farmerId: ctx.farmerId,
    action: input.action,
    quantity: input.quantityKg,
    source: ctx.source,
    idempotencyKey: `${ctx.requestKey}:${offer.id}`,
  });
  const ing = await ctx.db.ingredient.findUniqueOrThrow({ where: { id: offer.ingredientId } });
  return { ok: true as const, offerId: offer.id, outcome, message: outcomeText(ctx.language, ing, outcome) };
}

export async function getHarvestPlan(ctx: AssistantContext) {
  const [profile, commitments] = await Promise.all([
    getFarmerProfile(ctx),
    ctx.db.farmerCommitment.findMany({
      where: { farmerId: ctx.farmerId, status: "COMMITTED", offer: { status: { in: ["ACCEPTED", "PARTIALLY_COMMITTED", "OFFERED"] } } },
      include: { offer: { include: { ingredient: true } } },
    }),
  ]);
  return {
    crops: profile.crops,
    commitments: commitments.map((c) => ({
      ingredient: c.offer.ingredient.name,
      quantityKg: c.quantity,
      neededBy: c.offer.neededBy.toISOString().slice(0, 10),
    })),
  };
}

export async function getPaymentStatus(ctx: AssistantContext) {
  const payouts = await ctx.db.payout.findMany({
    where: { farmerId: ctx.farmerId },
    include: { commitment: { include: { offer: { include: { ingredient: true, payments: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  return payouts.map((p) => ({
    ingredient: p.commitment.offer.ingredient.name,
    quantityKg: p.commitment.quantity,
    amount: p.amount,
    payoutStatus: p.status,
    simulated: p.provider === "simulated",
    cafePayment: p.commitment.offer.payments[0]?.status ?? "PENDING",
  }));
}

export async function getLatestCropAnalysis(ctx: AssistantContext) {
  const a = await ctx.db.cropAnalysis.findFirst({ where: { farmerId: ctx.farmerId }, orderBy: { createdAt: "desc" } });
  return a ? { analysisId: a.id, createdAt: a.createdAt.toISOString(), isDemo: a.isDemo, result: a.result } : null;
}

export function searchAgriKnowledge(ctx: AssistantContext, query: string, crop?: string | null) {
  return searchKnowledge(query, crop).map((e) => ({ title: e.title, guidance: e.text[ctx.language], source: e.source }));
}

export async function escalateToExpert(ctx: AssistantContext, reason: string) {
  const latest = await ctx.db.cropAnalysis.findFirst({ where: { farmerId: ctx.farmerId }, orderBy: { createdAt: "desc" } });
  if (latest && !latest.expertRequestedAt) {
    await ctx.db.cropAnalysis.update({ where: { id: latest.id }, data: { expertRequestedAt: new Date() } });
  }
  await audit(ctx.db, ctx.actor, "expert.requested", "Farmer", ctx.farmerId, { reason, analysisId: latest?.id ?? null });
  return { requested: true, message: T.expertRequested(ctx.language) };
}

export function cropLabel(lang: Lang, ing: { name: string; nameHi: string | null; nameMr: string | null }) {
  return ingredientName(lang, ing);
}

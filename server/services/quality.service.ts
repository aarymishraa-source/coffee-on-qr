import "server-only";
import { z } from "zod";
import { HumanMessage } from "@langchain/core/messages";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess, canReviewQuality } from "@/server/auth/access";
import { getChatModel } from "@/server/integrations/langchain/model";
import { gradePrompt } from "@/server/assistant/prompts";
import { gradeSchema } from "@/server/assistant/schemas";
import { audit } from "./audit.service";
import { postMessage } from "./conversation.service";
import { readMediaBytes, toDataUrl } from "./media.service";

// Harvest batches linked to a commitment. The preliminary grade is a visual
// check only — never a food-safety certificate — and a person confirms or
// corrects it before delivery.

export const createBatchSchema = z.object({
  offerId: z.string().min(1),
  farmerId: z.string().min(1),
  quantity: z.number().positive().max(100_000),
  harvestDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mediaId: z.string().optional(),
});

export const reviewSchema = z.object({
  action: z.literal("review"),
  grade: z.enum(["A", "B", "C"]),
  reason: z.string().trim().min(3, "Add a short reason").max(300),
});
export const batchActionSchema = z.discriminatedUnion("action", [
  reviewSchema,
  z.object({ action: z.literal("pickup") }),
  z.object({ action: z.literal("in_transit") }),
  z.object({ action: z.literal("deliver") }),
]);

const DEMO_REASONS = ["Leaves look fresh and green in the photo", "No visible spots, holes or wilting", "Bunches look uniform in size"];

export async function createBatch(db: Db, actor: Actor, input: z.infer<typeof createBatchSchema>) {
  if (actor.role === "CAFE_MANAGER") throw new ApiError(403, "forbidden", "Farmers, agents or the FPO log harvests.");
  await assertFarmerAccess(db, actor, input.farmerId);
  const commitment = await db.farmerCommitment.findUnique({
    where: { offerId_farmerId: { offerId: input.offerId, farmerId: input.farmerId } },
    include: { offer: { include: { ingredient: true } }, batches: true, farmer: true },
  });
  if (!commitment || commitment.status !== "COMMITTED") throw new ApiError(409, "no_commitment", "There's no commitment for this order to harvest against.");
  const logged = commitment.batches.reduce((a, b) => a + b.quantity, 0);
  if (input.quantity > commitment.quantity - logged + 1e-9) {
    throw new ApiError(400, "exceeds_commitment", `Only ${commitment.quantity - logged} kg of the commitment is left to log.`);
  }

  let grade: "A" | "B" | "C" = "A";
  let reasons = DEMO_REASONS;
  let gradeSource = "demo";
  if (input.mediaId) {
    const llm = await getChatModel();
    if (llm) {
      try {
        const { bytes, mimeType } = await readMediaBytes(db, input.mediaId);
        const r = gradeSchema.parse(
          await llm.model.withStructuredOutput(gradeSchema, { name: "harvest_grade" }).invoke([
            new HumanMessage({
              content: [
                { type: "text", text: gradePrompt(commitment.offer.ingredient.name) },
                { type: "image_url", image_url: { url: toDataUrl(bytes, mimeType) } },
              ],
            }),
          ])
        );
        if (r.image_usable) {
          grade = r.grade;
          reasons = r.reasons;
          gradeSource = "vision-model";
        }
      } catch (err) {
        logger.warn("quality: grading model failed, using demo grade", { error: err instanceof Error ? err.message : String(err) });
      }
    }
  }

  const prefix = commitment.offer.ingredient.name.slice(0, 3).toUpperCase();
  const count = await db.harvestBatch.count({ where: { code: { startsWith: prefix } } });
  const creator = await db.user.findUnique({ where: { id: commitment.offer.createdById } });
  const batch = await db.harvestBatch.create({
    data: {
      code: `${prefix}-${input.harvestDate.slice(5).replace("-", "")}${String(count + 1).padStart(2, "0")}`,
      commitmentId: commitment.id,
      farmerId: commitment.farmerId,
      fpoId: commitment.offer.fpoId,
      cafeId: creator?.cafeId ?? "brew-room",
      crop: commitment.offer.ingredientId,
      harvestDate: new Date(`${input.harvestDate}T01:30:00Z`),
      quantity: input.quantity,
      mediaIds: input.mediaId ? [input.mediaId] : [],
      prelimGrade: grade,
      gradeReasons: reasons,
      gradeSource,
      isDemo: commitment.farmer.isDemo,
    },
  });
  await audit(db, actor, "batch.logged", "HarvestBatch", batch.id, { code: batch.code, quantity: batch.quantity, prelimGrade: grade, gradeSource });
  await postMessage(db, {
    farmerId: commitment.farmerId,
    direction: "OUT",
    author: "SYSTEM",
    type: "BATCH",
    body: `Harvest logged: ${batch.code} · ${batch.quantity} kg ${commitment.offer.ingredient.name.toLowerCase()} · preliminary grade ${grade}${gradeSource === "demo" ? " (demo grade)" : ""}. Staff will confirm the grade at pickup.`,
    payload: { batchId: batch.id },
    isDemoReply: gradeSource === "demo",
  });
  return batch;
}

export async function actOnBatch(db: Db, actor: Actor, batchId: string, input: z.infer<typeof batchActionSchema>) {
  if (!canReviewQuality(actor)) throw new ApiError(403, "forbidden", "Only café or FPO staff can review batches.");
  const batch = await db.harvestBatch.findUnique({ where: { id: batchId }, include: { commitment: { include: { offer: true } } } });
  if (!batch) throw new ApiError(404, "not_found", "Batch not found.");
  if (actor.role === "FPO_MANAGER" && batch.fpoId !== actor.fpoId) throw new ApiError(404, "not_found", "Batch not found.");

  if (input.action === "review") {
    const from = batch.finalGrade ?? batch.prelimGrade;
    await db.$transaction([
      db.qualityReview.create({ data: { batchId, reviewerId: actor.id ?? "system", fromGrade: from, toGrade: input.grade, reason: input.reason } }),
      db.harvestBatch.update({
        where: { id: batchId },
        data: { finalGrade: input.grade, reviewStatus: input.grade === batch.prelimGrade ? "CONFIRMED" : "CORRECTED" },
      }),
    ]);
    await audit(db, actor, input.grade === batch.prelimGrade ? "grade.confirmed" : "grade.corrected", "HarvestBatch", batchId, {
      code: batch.code, from, to: input.grade, reason: input.reason,
    });
    return { ok: true };
  }

  if (input.action === "pickup") {
    await db.harvestBatch.update({ where: { id: batchId }, data: { pickupStatus: "PICKED_UP" } });
    await audit(db, actor, "batch.picked_up", "HarvestBatch", batchId, { code: batch.code });
    return { ok: true };
  }
  if (input.action === "in_transit") {
    if (batch.pickupStatus !== "PICKED_UP") throw new ApiError(409, "not_picked_up", "Mark the batch as picked up first.");
    await db.harvestBatch.update({ where: { id: batchId }, data: { deliveryStatus: "IN_TRANSIT" } });
    await audit(db, actor, "batch.in_transit", "HarvestBatch", batchId, { code: batch.code });
    return { ok: true };
  }

  // deliver
  if (batch.reviewStatus === "PENDING") throw new ApiError(409, "grade_unreviewed", "Confirm or correct the grade before delivery.");
  await db.harvestBatch.update({
    where: { id: batchId },
    data: { deliveryStatus: "DELIVERED", pickupStatus: "PICKED_UP", deliveredAt: new Date() },
  });
  await audit(db, actor, "batch.delivered", "HarvestBatch", batchId, { code: batch.code });
  const offer = batch.commitment.offer;
  const delivered = await db.harvestBatch.aggregate({
    where: { commitment: { offerId: offer.id }, deliveryStatus: "DELIVERED" },
    _sum: { quantity: true },
  });
  if ((delivered._sum.quantity ?? 0) >= offer.quantity - 1e-9 && offer.status !== "FULFILLED") {
    await db.demandOffer.update({ where: { id: offer.id }, data: { status: "FULFILLED" } });
    await audit(db, actor, "offer.fulfilled", "DemandOffer", offer.id, { quantity: offer.quantity });
  }
  return { ok: true };
}

export async function listBatches(db: Db, actor: Actor) {
  const where =
    actor.role === "ADMIN" || actor.role === "CAFE_MANAGER"
      ? {}
      : actor.role === "FPO_MANAGER"
        ? { fpoId: actor.fpoId ?? "__none__" }
        : { id: "__none__" };
  const batches = await db.harvestBatch.findMany({
    where,
    include: { farmer: true, cafe: true, reviews: { orderBy: { createdAt: "desc" } }, commitment: { include: { offer: { include: { ingredient: true } } } } },
    orderBy: { createdAt: "desc" },
  });
  const reviewers = await db.user.findMany({ select: { id: true, name: true } });
  const name = new Map(reviewers.map((r) => [r.id, r.name]));
  return batches.map((b) => ({
    id: b.id,
    code: b.code,
    crop: b.commitment.offer.ingredient.name,
    farmer: b.farmer.name,
    village: b.farmer.village,
    cafe: b.cafe.name,
    quantity: b.quantity,
    harvestDate: b.harvestDate.toISOString(),
    prelimGrade: b.prelimGrade,
    finalGrade: b.finalGrade,
    gradeReasons: b.gradeReasons,
    gradeSource: b.gradeSource,
    reviewStatus: b.reviewStatus,
    pickupStatus: b.pickupStatus,
    deliveryStatus: b.deliveryStatus,
    deliveredAt: b.deliveredAt?.toISOString() ?? null,
    photoUrls: b.mediaIds.map((m) => `/api/media/${m}`),
    offerStatus: b.commitment.offer.status,
    reviews: b.reviews.map((r) => ({ from: r.fromGrade, to: r.toGrade, reason: r.reason, by: name.get(r.reviewerId) ?? "Staff", at: r.createdAt.toISOString() })),
  }));
}

function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** Public: the farm behind a dish — only delivered batches, only farmers who consented. */
export async function getFarmStory(db: Db, dishId: string) {
  const item = await db.menuItem.findUnique({ where: { id: dishId }, include: { recipe: true, cafe: true } });
  if (!item) return null;
  const ingredientIds = item.recipe.map((r) => r.ingredientId);
  const batch = await db.harvestBatch.findFirst({
    where: { crop: { in: ingredientIds }, deliveryStatus: "DELIVERED", farmer: { consentFarmStory: true }, reviewStatus: { not: "PENDING" } },
    orderBy: [{ deliveredAt: "desc" }],
    include: { farmer: true, fpo: true, commitment: { include: { offer: { include: { ingredient: true } } } } },
  });
  if (!batch) return null;
  const f = batch.farmer;
  return {
    farmerName: f.name,
    village: f.village,
    district: f.district,
    fpo: batch.fpo.name,
    ingredient: batch.commitment.offer.ingredient.name,
    harvestDate: batch.harvestDate.toISOString(),
    grade: batch.finalGrade ?? batch.prelimGrade,
    distanceKm: f.lat != null && f.lng != null ? km({ lat: f.lat, lng: f.lng }, item.cafe) : null,
    isDemo: batch.isDemo,
  };
}

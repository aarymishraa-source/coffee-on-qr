import "server-only";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess, farmerScope } from "@/server/auth/access";
import { audit } from "./audit.service";

export const CROP_STAGES = ["SOWING", "VEGETATIVE", "FLOWERING", "HARVEST_READY", "HARVESTED"] as const;

/** Accepts 10-digit Indian mobiles with optional +91 / 91 / 0 prefix; stores "91XXXXXXXXXX". */
export function normalisePhone(raw: string): string | null {
  let d = raw.replace(/\D/g, "");
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (!/^[6-9]\d{9}$/.test(d)) return null;
  return `91${d}`;
}

const optionalNumber = (min: number, max: number) =>
  z.preprocess((v) => (v === "" || v === null || v === undefined ? undefined : Number(v)), z.number().min(min).max(max).optional());

export const farmerSchema = z.object({
  name: z.string().trim().min(2, "Enter the farmer's full name").max(80),
  phone: z
    .string()
    .trim()
    .transform((v, ctx) => {
      const p = normalisePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Enter a 10-digit Indian mobile number" });
        return z.NEVER;
      }
      return p;
    }),
  language: z.enum(["en", "hi", "mr"]),
  village: z.string().trim().min(2, "Enter the village").max(80),
  district: z.string().trim().min(2, "Enter the district").max(80),
  crops: z
    .array(z.object({ crop: z.string().min(1, "Pick a crop"), stage: z.enum(CROP_STAGES) }))
    .min(1, "Add at least one crop")
    .max(10),
  fpoId: z.string().optional().nullable(),
  fieldAgentId: z.string().optional().nullable(),
  areaAcres: optionalNumber(0, 1000),
  lat: optionalNumber(-90, 90),
  lng: optionalNumber(-180, 180),
  contactPreference: z.enum(["WHATSAPP", "CALL", "SMS"]).default("WHATSAPP"),
  consentData: z.boolean(),
  consentFarmStory: z.boolean().default(false),
});
export type FarmerInput = z.infer<typeof farmerSchema>;

export const farmerFilterSchema = z.object({
  q: z.string().trim().max(80).optional(),
  crop: z.string().optional(),
  stage: z.enum(CROP_STAGES).optional(),
  language: z.enum(["en", "hi", "mr"]).optional(),
});

const CAN_REGISTER = ["ADMIN", "FPO_MANAGER", "FIELD_AGENT"];

export async function listFarmers(db: Db, actor: Actor, filter: z.infer<typeof farmerFilterSchema> = {}) {
  const and: Prisma.FarmerWhereInput[] = [farmerScope(actor)];
  if (filter.q) {
    and.push({
      OR: [
        { name: { contains: filter.q, mode: "insensitive" } },
        { village: { contains: filter.q, mode: "insensitive" } },
        { phone: { contains: filter.q.replace(/\D/g, "") || "__none__" } },
      ],
    });
  }
  if (filter.crop || filter.stage) {
    and.push({ crops: { some: { ...(filter.crop ? { crop: filter.crop } : {}), ...(filter.stage ? { stage: filter.stage } : {}) } } });
  }
  if (filter.language) and.push({ language: filter.language });
  const farmers = await db.farmer.findMany({
    where: { AND: and },
    include: { crops: true, fieldAgent: true, fpo: true },
    orderBy: { name: "asc" },
  });
  return farmers.map((f) => ({
    id: f.id,
    name: f.name,
    phone: f.phone,
    language: f.language,
    village: f.village,
    district: f.district,
    fpo: f.fpo?.name ?? null,
    fieldAgent: f.fieldAgent?.name ?? null,
    crops: f.crops.map((c) => ({ crop: c.crop, stage: c.stage })),
    consentFarmStory: f.consentFarmStory,
    isDemo: f.isDemo,
  }));
}

export async function getFarmer(db: Db, actor: Actor, id: string) {
  await assertFarmerAccess(db, actor, id);
  const f = await db.farmer.findUniqueOrThrow({
    where: { id },
    include: {
      crops: true,
      fpo: true,
      fieldAgent: true,
      commitments: { include: { offer: { include: { ingredient: true } } }, orderBy: { updatedAt: "desc" } },
    },
  });
  return {
    id: f.id,
    name: f.name,
    phone: f.phone,
    language: f.language,
    village: f.village,
    district: f.district,
    fpoId: f.fpoId,
    fpo: f.fpo?.name ?? null,
    fieldAgentId: f.fieldAgentId,
    fieldAgent: f.fieldAgent?.name ?? null,
    areaAcres: f.areaAcres,
    lat: f.lat,
    lng: f.lng,
    contactPreference: f.contactPreference,
    consentData: f.consentData,
    consentFarmStory: f.consentFarmStory,
    consentAt: f.consentAt?.toISOString() ?? null,
    isDemo: f.isDemo,
    crops: f.crops.map((c) => ({
      crop: c.crop,
      stage: c.stage,
      expectedHarvestDate: c.expectedHarvestDate?.toISOString() ?? null,
      expectedQtyKg: c.expectedQtyKg,
    })),
    commitments: f.commitments.map((c) => ({
      id: c.id,
      ingredient: c.offer.ingredient.name,
      unit: c.offer.ingredient.unit,
      quantity: c.quantity,
      status: c.status,
      offerStatus: c.offer.status,
      offerQuantity: c.offer.quantity,
      neededBy: c.offer.neededBy.toISOString(),
    })),
  };
}

/** Applies role rules to the FPO and field agent a farmer is attached to. */
async function scopedAssignment(db: Db, actor: Actor, input: FarmerInput) {
  if (!CAN_REGISTER.includes(actor.role)) throw new ApiError(403, "forbidden", "Your role can't register or edit farmers.");
  let fpoId = input.fpoId ?? null;
  let fieldAgentId = input.fieldAgentId ?? null;
  if (actor.role === "FIELD_AGENT") {
    fieldAgentId = actor.fieldAgentId;
    fpoId = actor.fpoId;
  } else if (actor.role === "FPO_MANAGER") {
    fpoId = actor.fpoId;
  }
  if (fpoId && !(await db.fpo.findUnique({ where: { id: fpoId } }))) throw new ApiError(400, "invalid_fpo", "That FPO doesn't exist.");
  if (fieldAgentId) {
    const agent = await db.fieldAgent.findUnique({ where: { id: fieldAgentId } });
    if (!agent) throw new ApiError(400, "invalid_agent", "That field agent doesn't exist.");
    if (fpoId && agent.fpoId !== fpoId) throw new ApiError(400, "invalid_agent", "That field agent belongs to a different FPO.");
  }
  return { fpoId, fieldAgentId };
}

async function validateCrops(db: Db, crops: FarmerInput["crops"]) {
  const ids = [...new Set(crops.map((c) => c.crop))];
  const found = await db.ingredient.findMany({ where: { id: { in: ids }, farmSourced: true } });
  if (found.length !== ids.length) throw new ApiError(400, "invalid_crop", "Pick crops from the list.");
}

async function assertPhoneFree(db: Db, phone: string, exceptId?: string) {
  const other = await db.farmer.findUnique({ where: { phone } });
  if (other && other.id !== exceptId) throw new ApiError(409, "duplicate_phone", "A farmer with this phone number is already registered.");
}

export async function createFarmer(db: Db, actor: Actor, input: FarmerInput) {
  if (!input.consentData) throw new ApiError(400, "consent_required", "The farmer must agree to us storing their details.");
  const { fpoId, fieldAgentId } = await scopedAssignment(db, actor, input);
  await validateCrops(db, input.crops);
  await assertPhoneFree(db, input.phone);
  const farmer = await db.farmer.create({
    data: {
      name: input.name,
      phone: input.phone,
      language: input.language,
      village: input.village,
      district: input.district,
      fpoId,
      fieldAgentId,
      areaAcres: input.areaAcres ?? null,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      contactPreference: input.contactPreference,
      consentData: true,
      consentFarmStory: input.consentFarmStory,
      consentAt: new Date(),
      isDemo: actor.isDemo,
      crops: { create: input.crops.map((c) => ({ crop: c.crop, stage: c.stage })) },
      conversation: { create: {} },
    },
  });
  await audit(db, actor, "farmer.registered", "Farmer", farmer.id, { name: farmer.name, village: farmer.village });
  return { id: farmer.id, name: farmer.name };
}

export async function updateFarmer(db: Db, actor: Actor, id: string, input: FarmerInput) {
  await assertFarmerAccess(db, actor, id);
  if (!input.consentData) throw new ApiError(400, "consent_required", "The farmer must agree to us storing their details.");
  const existing = await db.farmer.findUniqueOrThrow({ where: { id } });
  const { fpoId, fieldAgentId } = await scopedAssignment(db, actor, input);
  await validateCrops(db, input.crops);
  await assertPhoneFree(db, input.phone, id);
  const consentChanged = existing.consentFarmStory !== input.consentFarmStory;
  await db.$transaction(async (tx) => {
    await tx.farmerCrop.deleteMany({ where: { farmerId: id } });
    await tx.farmer.update({
      where: { id },
      data: {
        name: input.name,
        phone: input.phone,
        language: input.language,
        village: input.village,
        district: input.district,
        fpoId,
        fieldAgentId,
        areaAcres: input.areaAcres ?? null,
        lat: input.lat ?? null,
        lng: input.lng ?? null,
        contactPreference: input.contactPreference,
        consentFarmStory: input.consentFarmStory,
        ...(consentChanged ? { consentAt: new Date() } : {}),
        crops: { create: input.crops.map((c) => ({ crop: c.crop, stage: c.stage })) },
      },
    });
    await audit(tx, actor, "farmer.updated", "Farmer", id, { name: input.name, consentFarmStory: input.consentFarmStory });
  });
  return { id, name: input.name };
}

export async function getFpoOverview(db: Db, actor: Actor, fpoId: string) {
  if (actor.role !== "ADMIN" && !(actor.role === "FPO_MANAGER" && actor.fpoId === fpoId)) {
    throw new ApiError(403, "forbidden", "Only this FPO's manager can see its overview.");
  }
  const fpo = await db.fpo.findUnique({ where: { id: fpoId } });
  if (!fpo) throw new ApiError(404, "not_found", "FPO not found.");
  const [farmerCount, agentCount, offers, payouts] = await Promise.all([
    db.farmer.count({ where: { fpoId } }),
    db.fieldAgent.count({ where: { fpoId } }),
    db.demandOffer.findMany({
      where: { fpoId, status: { not: "DRAFT" } },
      include: {
        ingredient: true,
        commitments: { include: { farmer: true }, orderBy: { createdAt: "asc" } },
        payments: { orderBy: { createdAt: "desc" }, take: 1 },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.payout.findMany({ where: { farmer: { fpoId } }, include: { farmer: true, commitment: { include: { offer: { include: { ingredient: true } } } } }, orderBy: { createdAt: "desc" } }),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const o of offers) statusCounts[o.status] = (statusCounts[o.status] ?? 0) + 1;
  const mapOffer = (o: (typeof offers)[number]) => {
    const live = o.commitments.filter((c) => c.status === "COMMITTED");
    const committed = live.reduce((a, c) => a + c.quantity, 0);
    return {
      id: o.id,
      ingredient: o.ingredient.name,
      unit: o.ingredient.unit,
      quantity: o.quantity,
      pricePerKg: o.pricePerKg,
      status: o.status,
      neededBy: o.neededBy.toISOString(),
      committed: Math.round(committed * 100) / 100,
      commitments: live.map((c) => ({ farmerName: c.farmer.name, quantity: c.quantity })),
      declined: o.commitments.filter((c) => c.status === "DECLINED").map((c) => c.farmer.name),
      payment: o.payments[0] ? { status: o.payments[0].status, provider: o.payments[0].provider, amount: o.payments[0].amount } : null,
    };
  };
  const open = offers.filter((o) => ["OFFERED", "PARTIALLY_COMMITTED", "ACCEPTED"].includes(o.status));
  return {
    fpo: { id: fpo.id, name: fpo.name, district: fpo.district, state: fpo.state },
    farmerCount,
    agentCount,
    statusCounts,
    openOffers: open.map(mapOffer),
    offers: offers.map(mapOffer),
    payouts: payouts.map((p) => ({
      id: p.id,
      farmerName: p.farmer.name,
      ingredient: p.commitment.offer.ingredient.name,
      amount: p.amount,
      status: p.status,
      simulated: p.provider === "simulated",
    })),
  };
}

export async function listAgents(db: Db, actor: Actor) {
  if (actor.role !== "ADMIN" && actor.role !== "FPO_MANAGER") throw new ApiError(403, "forbidden", "Only FPO managers can see field agents.");
  const agents = await db.fieldAgent.findMany({
    where: actor.role === "ADMIN" ? {} : { fpoId: actor.fpoId ?? "__none__" },
    include: { farmers: { orderBy: { name: "asc" }, include: { crops: true } }, fpo: true },
    orderBy: { name: "asc" },
  });
  return agents.map((a) => ({
    id: a.id,
    name: a.name,
    phone: a.phone,
    fpo: a.fpo.name,
    farmerCount: a.farmers.length,
    farmers: a.farmers.map((f) => ({ id: f.id, name: f.name, village: f.village, crops: f.crops.map((c) => c.crop) })),
  }));
}

/** Agents the actor may assign a farmer to (for the form's select). */
export async function assignableAgents(db: Db, actor: Actor) {
  const where: Prisma.FieldAgentWhereInput =
    actor.role === "ADMIN" ? {} : actor.role === "FIELD_AGENT" ? { id: actor.fieldAgentId ?? "__none__" } : { fpoId: actor.fpoId ?? "__none__" };
  return (await db.fieldAgent.findMany({ where, orderBy: { name: "asc" } })).map((a) => ({ id: a.id, name: a.name, fpoId: a.fpoId }));
}

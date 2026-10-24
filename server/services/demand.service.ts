import "server-only";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import type { Actor } from "@/server/auth/types";
import { canManageSupply } from "@/server/auth/access";
import { getDailySales, getDailyOrderTotals, getLastSalesDate } from "@/server/repositories/sales.repository";
import {
  addDays, computeForecast, supplyPosition, HISTORY_DAYS, type ForecastResult, type IngredientForecast,
} from "./forecast.service";
import { audit } from "./audit.service";
import { offerCardText, postMessage } from "./conversation.service";

const OPEN_STATUSES = ["OFFERED", "PARTIALLY_COMMITTED", "ACCEPTED", "FULFILLED"] as const;

/** Forecast for the 7 days after the latest recorded sales day. */
export async function buildForecast(db: Db): Promise<ForecastResult> {
  const last = (await getLastSalesDate(db)) ?? new Date().toISOString().slice(0, 10);
  const startDate = addDays(last, 1);
  const [sales, menuItems, recipes, ingredients, stock] = await Promise.all([
    getDailySales(db, addDays(startDate, -HISTORY_DAYS), startDate),
    db.menuItem.findMany({ where: { active: true }, include: { cafe: true } }),
    db.recipeIngredient.findMany(),
    db.ingredient.findMany({ orderBy: { name: "asc" } }),
    db.stockLevel.groupBy({ by: ["ingredientId"], _sum: { quantity: true } }),
  ]);
  return computeForecast({
    startDate,
    sales,
    menuItems: menuItems.map((m) => ({ id: m.id, name: m.name, cafeName: m.cafe.name })),
    recipes,
    ingredients,
    stock: Object.fromEntries(stock.map((s) => [s.ingredientId, s._sum.quantity ?? 0])),
  });
}

export type SupplyStatus = "covered" | "supplier" | "not_offered" | "offered" | "partial" | "committed" | "fulfilled";

export interface SupplyRow extends IngredientForecast {
  farmSourced: boolean;
  pricePerKg: number;
  adjusted: number | null;
  target: number; // adjusted ?? suggested, or the live offer's quantity
  committed: number;
  open: number;
  position: number; // + surplus / − shortage after stock and commitments
  status: SupplyStatus;
  offer: {
    id: string;
    status: string;
    quantity: number;
    pricePerKg: number;
    sentAt: string | null;
    commitments: { farmerId: string; farmerName: string; village: string; quantity: number; status: string; at: string }[];
  } | null;
  adjustments: { from: number; to: number; reason: string; at: string; by: string }[];
}

export async function getSupplyOverview(db: Db) {
  const forecast = await buildForecast(db);
  const weekStart = new Date(`${forecast.startDate}T00:00:00Z`);
  const [snapshots, offers, users, trend, ingredients] = await Promise.all([
    db.demandForecast.findMany({ where: { weekStart }, include: { adjustments: { orderBy: { createdAt: "asc" } } } }),
    db.demandOffer.findMany({
      where: { status: { in: [...OPEN_STATUSES] }, forecast: { weekStart } },
      include: { commitments: { include: { farmer: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({ select: { id: true, name: true } }),
    getDailyOrderTotals(db, forecast.historyStart, forecast.startDate),
    db.ingredient.findMany(),
  ]);
  const ingById = new Map(ingredients.map((i) => [i.id, i]));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  const rows: SupplyRow[] = forecast.ingredients
    .filter((i) => i.forecast > 0)
    .map((f) => {
      const snap = snapshots.find((s) => s.ingredientId === f.ingredientId);
      const offer = offers.find((o) => o.ingredientId === f.ingredientId) ?? null;
      const live = offer?.commitments.filter((c) => c.status === "COMMITTED") ?? [];
      const committed = round2(live.reduce((a, c) => a + c.quantity, 0));
      const adjusted = snap?.adjustedQty ?? null;
      const target = offer ? offer.quantity : (adjusted ?? f.suggested);
      const open = round2(Math.max(0, target - committed));
      const ing = ingById.get(f.ingredientId)!;
      const status: SupplyStatus = !ing.farmSourced
        ? "supplier"
        : offer
        ? offer.status === "FULFILLED"
          ? "fulfilled"
          : open === 0
            ? "committed"
            : committed > 0
              ? "partial"
              : "offered"
        : target === 0
          ? "covered"
          : "not_offered";
      return {
        ...f,
        farmSourced: ing.farmSourced,
        pricePerKg: ing.pricePerKg,
        adjusted,
        target,
        committed,
        open,
        position: supplyPosition(f, committed),
        status,
        offer: offer && {
          id: offer.id,
          status: offer.status,
          quantity: offer.quantity,
          pricePerKg: offer.pricePerKg,
          sentAt: offer.sentAt?.toISOString() ?? null,
          commitments: offer.commitments.map((c) => ({
            farmerId: c.farmerId,
            farmerName: c.farmer.name,
            village: c.farmer.village,
            quantity: c.quantity,
            status: c.status,
            at: c.updatedAt.toISOString(),
          })),
        },
        adjustments: (snap?.adjustments ?? []).map((a) => ({
          from: a.fromQty,
          to: a.toQty,
          reason: a.reason,
          at: a.createdAt.toISOString(),
          by: userName.get(a.userId) ?? "Unknown",
        })),
      };
    })
    // Most valuable open farm need first; supplier-sourced items last.
    .sort((a, b) => actionValue(b) - actionValue(a) || b.forecast - a.forecast);

  return { forecast: { ...forecast, ingredients: undefined }, rows, trend };
}

function actionValue(r: SupplyRow) {
  if (!r.farmSourced) return -1;
  return r.open * r.pricePerKg;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

async function snapshotFor(db: Db | Prisma.TransactionClient, f: IngredientForecast, weekStart: Date, method: string) {
  return db.demandForecast.upsert({
    where: { ingredientId_weekStart: { ingredientId: f.ingredientId, weekStart } },
    update: {},
    create: {
      ingredientId: f.ingredientId,
      weekStart,
      forecastQty: f.forecast,
      bufferQty: f.buffer,
      stockQty: f.stock,
      suggestedQty: f.suggested,
      method,
      breakdown: f.contributions as unknown as Prisma.InputJsonValue,
    },
  });
}

export const adjustSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.number().min(0).max(10_000),
  reason: z.string().trim().min(3, "Add a short reason").max(300),
});

export async function adjustForecast(db: Db, actor: Actor, input: z.infer<typeof adjustSchema>) {
  if (!canManageSupply(actor)) throw new ApiError(403, "forbidden", "Only café managers can adjust forecasts.");
  const forecast = await buildForecast(db);
  const f = forecast.ingredients.find((i) => i.ingredientId === input.ingredientId);
  if (!f) throw new ApiError(404, "not_found", "Ingredient not found.");
  const weekStart = new Date(`${forecast.startDate}T00:00:00Z`);
  const live = await db.demandOffer.findFirst({
    where: { ingredientId: f.ingredientId, status: { in: [...OPEN_STATUSES] }, forecast: { weekStart } },
  });
  if (live) throw new ApiError(409, "offer_exists", "An offer is already out for this week. Cancel it to change the quantity.");

  return db.$transaction(async (tx) => {
    const snap = await snapshotFor(tx, f, weekStart, forecast.method);
    const from = snap.adjustedQty ?? snap.suggestedQty;
    await tx.forecastAdjustment.create({
      data: { forecastId: snap.id, fromQty: from, toQty: input.quantity, reason: input.reason, userId: actor.id ?? "system" },
    });
    await tx.demandForecast.update({ where: { id: snap.id }, data: { adjustedQty: input.quantity } });
    await audit(tx, actor, "forecast.adjusted", "DemandForecast", snap.id, {
      ingredient: f.name, from, to: input.quantity, reason: input.reason,
    });
    return { from, to: input.quantity };
  });
}

export const sendOfferSchema = z.object({
  ingredientId: z.string().min(1),
  fpoId: z.string().min(1),
});

/** Approve the (possibly adjusted) quantity and send it to an FPO's matching farmers. */
export async function sendOffer(db: Db, actor: Actor, input: z.infer<typeof sendOfferSchema>) {
  if (!canManageSupply(actor)) throw new ApiError(403, "forbidden", "Only café managers can send offers.");
  const forecast = await buildForecast(db);
  const f = forecast.ingredients.find((i) => i.ingredientId === input.ingredientId);
  if (!f) throw new ApiError(404, "not_found", "Ingredient not found.");
  const [ingredient, fpo] = await Promise.all([
    db.ingredient.findUniqueOrThrow({ where: { id: input.ingredientId } }),
    db.fpo.findUnique({ where: { id: input.fpoId } }),
  ]);
  if (!fpo) throw new ApiError(404, "not_found", "FPO not found.");
  if (!ingredient.farmSourced) throw new ApiError(400, "not_farm_sourced", `${ingredient.name} comes from a regular supplier, not an FPO.`);
  const weekStart = new Date(`${forecast.startDate}T00:00:00Z`);

  const offer = await db.$transaction(async (tx) => {
    const existing = await tx.demandOffer.findFirst({
      where: { ingredientId: f.ingredientId, status: { in: [...OPEN_STATUSES] }, forecast: { weekStart } },
    });
    if (existing) throw new ApiError(409, "offer_exists", "An offer for this ingredient is already out this week.");
    const snap = await snapshotFor(tx, f, weekStart, forecast.method);
    const quantity = snap.adjustedQty ?? snap.suggestedQty;
    if (quantity <= 0) throw new ApiError(400, "nothing_needed", "Stock already covers next week's need.");
    const created = await tx.demandOffer.create({
      data: {
        ingredientId: f.ingredientId,
        forecastId: snap.id,
        fpoId: fpo.id,
        quantity,
        pricePerKg: ingredient.pricePerKg,
        neededBy: new Date(`${addDays(forecast.startDate, 1)}T03:30:00Z`),
        status: "OFFERED",
        createdById: actor.id ?? "system",
        sentAt: new Date(),
        isDemo: actor.isDemo,
      },
    });
    await audit(tx, actor, "offer.sent", "DemandOffer", created.id, {
      ingredient: ingredient.name, quantity, fpo: fpo.name, pricePerKg: ingredient.pricePerKg,
    });
    return created;
  });

  // Matched farmers: in this FPO, growing the crop, past the sowing stage.
  const farmers = await db.farmer.findMany({
    where: { fpoId: fpo.id, crops: { some: { crop: f.ingredientId, stage: { not: "SOWING" } } } },
  });
  for (const farmer of farmers) {
    await postMessage(db, {
      farmerId: farmer.id,
      direction: "OUT",
      author: "SYSTEM",
      type: "OFFER",
      body: offerCardText(farmer.language, ingredient, offer.quantity, offer.pricePerKg),
      payload: { offerId: offer.id, ingredientId: ingredient.id },
    });
  }
  return { offer, notified: farmers.map((x) => x.name) };
}

export async function cancelOffer(db: Db, actor: Actor, offerId: string, reason: string) {
  if (!canManageSupply(actor)) throw new ApiError(403, "forbidden", "Only café managers can cancel offers.");
  const offer = await db.demandOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw new ApiError(404, "not_found", "Offer not found.");
  if (offer.status === "FULFILLED") throw new ApiError(409, "fulfilled", "This order is already fulfilled.");
  await db.demandOffer.update({ where: { id: offerId }, data: { status: "CANCELLED" } });
  await audit(db, actor, "offer.cancelled", "DemandOffer", offerId, { reason });
}

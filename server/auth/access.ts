import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import { ApiError } from "@/lib/api";
import type { Db } from "@/lib/db";
import type { Actor } from "./types";

// Row-level access rules, enforced in services (not just the UI):
// - Admin: everything.
// - FPO manager: farmers, offers, batches of their FPO.
// - Field agent: only farmers assigned to them.
// - Farmer: only their own records.
// - Café manager: supply data, offers and aggregate commitments — not farmers' private records.

export function farmerScope(actor: Actor): Prisma.FarmerWhereInput {
  switch (actor.role) {
    case "ADMIN":
      return {};
    case "FPO_MANAGER":
      return { fpoId: actor.fpoId ?? "__none__" };
    case "FIELD_AGENT":
      return { fieldAgentId: actor.fieldAgentId ?? "__none__" };
    case "FARMER":
      return { id: actor.farmerId ?? "__none__" };
    default:
      return { id: "__none__" };
  }
}

export async function assertFarmerAccess(db: Db, actor: Actor, farmerId: string) {
  const found = await db.farmer.findFirst({ where: { AND: [{ id: farmerId }, farmerScope(actor)] }, select: { id: true } });
  if (!found) throw new ApiError(404, "not_found", "Farmer not found.");
}

export function canManageSupply(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "CAFE_MANAGER";
}

export function canReviewQuality(actor: Actor) {
  return actor.role === "ADMIN" || actor.role === "CAFE_MANAGER" || actor.role === "FPO_MANAGER";
}

/** Which offers an actor may see. */
export function offerScope(actor: Actor): Prisma.DemandOfferWhereInput {
  switch (actor.role) {
    case "ADMIN":
    case "CAFE_MANAGER":
      return {};
    case "FPO_MANAGER":
    case "FIELD_AGENT":
      return { fpoId: actor.fpoId ?? "__none__" };
    case "FARMER":
      return { fpoId: actor.fpoId ?? "__none__", status: { not: "DRAFT" } };
  }
}

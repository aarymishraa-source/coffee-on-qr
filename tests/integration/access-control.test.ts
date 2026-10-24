import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import { getFarmer, getFpoOverview, listAgents, listFarmers } from "@/server/services/farmer.service";
import { respondToOffer } from "@/server/services/order.service";
import { sendOffer } from "@/server/services/demand.service";
import { ApiError } from "@/lib/api";

let db: PrismaClient;
let tomatoOfferId: string;
beforeAll(async () => {
  db = await createTestDb();
  tomatoOfferId = (await db.demandOffer.findFirstOrThrow({ where: { ingredientId: "tomato", status: "PARTIALLY_COMMITTED" } })).id;
});

const ids = async (userId: string) => (await listFarmers(db, await actorFor(db, userId))).map((f) => f.id).sort();

async function statusOf(p: Promise<unknown>) {
  try {
    await p;
    return 200;
  } catch (e) {
    if (e instanceof ApiError) return e.status;
    throw e;
  }
}

describe("row-level access control", () => {
  test("each role sees only its farmers", async () => {
    expect(await ids("user-kavita")).toEqual(["farmer-ganesh", "farmer-mohan", "farmer-ramesh"]);
    expect(await ids("user-anil")).toEqual(["farmer-asha", "farmer-lakshmi", "farmer-sunita"]);
    expect(await ids("user-ramesh")).toEqual(["farmer-ramesh"]);
    expect(await ids("user-fpo")).toHaveLength(6);
    expect(await ids("user-admin")).toHaveLength(6);
    expect(await ids("user-cafe")).toEqual([]);
  });

  test("opening another agent's or farmer's record is a 404", async () => {
    expect(await statusOf(getFarmer(db, await actorFor(db, "user-kavita"), "farmer-sunita"))).toBe(404);
    expect(await statusOf(getFarmer(db, await actorFor(db, "user-ramesh"), "farmer-sunita"))).toBe(404);
    expect(await statusOf(getFarmer(db, await actorFor(db, "user-cafe"), "farmer-ramesh"))).toBe(404);
    expect(await statusOf(getFarmer(db, await actorFor(db, "user-kavita"), "farmer-ramesh"))).toBe(200);
  });

  test("nobody can answer an offer for a farmer they can't see", async () => {
    const body = { offerId: tomatoOfferId, farmerId: "farmer-asha", action: "commit" as const, quantity: 1, source: "CHAT" as const };
    expect(await statusOf(respondToOffer(db, await actorFor(db, "user-kavita"), body))).toBe(404);
    expect(await statusOf(respondToOffer(db, await actorFor(db, "user-ramesh"), body))).toBe(404);
    expect(await statusOf(respondToOffer(db, await actorFor(db, "user-cafe"), body))).toBe(404);
    // Nothing was written.
    expect(await db.farmerCommitment.count({ where: { offerId: tomatoOfferId, farmerId: "farmer-asha" } })).toBe(0);
  });

  test("only café managers and admins send offers", async () => {
    const input = { ingredientId: "mushroom", fpoId: "palghar-kisan-fpo" };
    expect(await statusOf(sendOffer(db, await actorFor(db, "user-kavita"), input))).toBe(403);
    expect(await statusOf(sendOffer(db, await actorFor(db, "user-fpo"), input))).toBe(403);
    expect(await statusOf(sendOffer(db, await actorFor(db, "user-ramesh"), input))).toBe(403);
  });

  test("FPO overview and agent list: FPO manager and admin only", async () => {
    expect(await statusOf(getFpoOverview(db, await actorFor(db, "user-fpo"), "palghar-kisan-fpo"))).toBe(200);
    expect(await statusOf(getFpoOverview(db, await actorFor(db, "user-admin"), "palghar-kisan-fpo"))).toBe(200);
    expect(await statusOf(getFpoOverview(db, await actorFor(db, "user-kavita"), "palghar-kisan-fpo"))).toBe(403);
    expect(await statusOf(getFpoOverview(db, await actorFor(db, "user-cafe"), "palghar-kisan-fpo"))).toBe(403);
    expect(await statusOf(listAgents(db, await actorFor(db, "user-kavita")))).toBe(403);
    expect(await statusOf(listAgents(db, await actorFor(db, "user-fpo")))).toBe(200);
  });
});

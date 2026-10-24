import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import {
  createFarmer, farmerSchema, getFarmer, getFpoOverview, listAgents, listFarmers, normalisePhone, updateFarmer,
} from "@/server/services/farmer.service";

let db: PrismaClient;
beforeAll(async () => {
  db = await createTestDb();
});

const input = (over: Record<string, unknown> = {}) =>
  farmerSchema.parse({
    name: "Vijay Dhumal",
    phone: "98765 43210",
    language: "mr",
    village: "Kelwa",
    district: "Palghar",
    crops: [{ crop: "basil", stage: "VEGETATIVE" }],
    contactPreference: "WHATSAPP",
    consentData: true,
    consentFarmStory: false,
    ...over,
  });

describe("farmer onboarding", () => {
  test("phone numbers are normalised to 91 + 10 digits", () => {
    expect(normalisePhone("+91 98765 43210")).toBe("919876543210");
    expect(normalisePhone("09876543210")).toBe("919876543210");
    expect(normalisePhone("12345")).toBeNull();
    expect(() => input({ phone: "5555" })).toThrow();
    expect(() => input({ crops: [] })).toThrow();
  });

  test("a field agent registers a farmer: agent and FPO are forced to their own", async () => {
    const kavita = await actorFor(db, "user-kavita");
    const r = await createFarmer(db, kavita, input({ fieldAgentId: "agent-anil", fpoId: null }));
    const f = await db.farmer.findUniqueOrThrow({ where: { id: r.id }, include: { crops: true, conversation: true } });
    expect(f.fieldAgentId).toBe("agent-kavita");
    expect(f.fpoId).toBe("palghar-kisan-fpo");
    expect(f.phone).toBe("919876543210");
    expect(f.isDemo).toBe(true);
    expect(f.consentAt).not.toBeNull();
    expect(f.crops).toHaveLength(1);
    expect(f.conversation).not.toBeNull();
    expect(await db.auditLog.count({ where: { action: "farmer.registered", entityId: r.id } })).toBe(1);
    // She can now see the new farmer.
    expect((await listFarmers(db, kavita)).map((x) => x.id)).toContain(r.id);
  });

  test("duplicate phone is rejected", async () => {
    const kavita = await actorFor(db, "user-kavita");
    await expect(createFarmer(db, kavita, input({ name: "Someone Else" }))).rejects.toThrow(/already registered/);
  });

  test("registration needs data consent", async () => {
    const kavita = await actorFor(db, "user-kavita");
    await expect(createFarmer(db, kavita, input({ phone: "9000000001", consentData: false }))).rejects.toThrow(/agree/);
  });

  test("crops must be farm-sourced ingredients", async () => {
    const kavita = await actorFor(db, "user-kavita");
    await expect(createFarmer(db, kavita, input({ phone: "9000000002", crops: [{ crop: "paneer", stage: "SOWING" }] }))).rejects.toThrow(/crops/);
  });

  test("FPO manager registration is pinned to their FPO; admin can choose", async () => {
    const fpo = await actorFor(db, "user-fpo");
    const r = await createFarmer(db, fpo, input({ phone: "9000000003", fieldAgentId: "agent-anil" }));
    const f = await db.farmer.findUniqueOrThrow({ where: { id: r.id } });
    expect(f.fpoId).toBe("palghar-kisan-fpo");
    expect(f.fieldAgentId).toBe("agent-anil");
  });

  test("café managers and farmers can't register farmers", async () => {
    const cafe = await actorFor(db, "user-cafe");
    await expect(createFarmer(db, cafe, input({ phone: "9000000004" }))).rejects.toThrow(/can't register/);
    const ramesh = await actorFor(db, "user-ramesh");
    await expect(createFarmer(db, ramesh, input({ phone: "9000000005" }))).rejects.toThrow(/can't register/);
  });

  test("updating a profile replaces crops and records consent changes", async () => {
    const kavita = await actorFor(db, "user-kavita");
    const before = await getFarmer(db, kavita, "farmer-ganesh");
    await updateFarmer(db, kavita, "farmer-ganesh", input({
      name: "Ganesh Valvi",
      phone: before.phone,
      village: "Jawhar",
      crops: [{ crop: "tomato", stage: "HARVESTED" }, { crop: "green-chilli", stage: "FLOWERING" }, { crop: "spinach", stage: "SOWING" }],
      consentFarmStory: false,
    }));
    const after = await getFarmer(db, kavita, "farmer-ganesh");
    expect(after.crops.map((c) => c.crop).sort()).toEqual(["green-chilli", "spinach", "tomato"]);
    expect(after.consentFarmStory).toBe(false);
    expect(await db.auditLog.count({ where: { action: "farmer.updated", entityId: "farmer-ganesh" } })).toBe(1);
  });

  test("search and filters", async () => {
    const fpo = await actorFor(db, "user-fpo");
    expect((await listFarmers(db, fpo, { q: "wada" })).map((f) => f.name)).toEqual(["Sunita Gawade"]);
    expect((await listFarmers(db, fpo, { crop: "basil", stage: "HARVEST_READY" })).map((f) => f.name).sort()).toEqual(["Ramesh Patil", "Sunita Gawade"]);
    expect((await listFarmers(db, fpo, { language: "hi" })).map((f) => f.name).sort()).toEqual(["Mohan Dhodi", "Sunita Gawade"]);
  });

  test("FPO overview shows open offers with commitments and payment status", async () => {
    const fpo = await actorFor(db, "user-fpo");
    const o = await getFpoOverview(db, fpo, "palghar-kisan-fpo");
    expect(o.farmerCount).toBeGreaterThanOrEqual(6);
    const tomato = o.openOffers.find((x) => x.ingredient === "Tomato")!;
    expect(tomato.commitments).toEqual([{ farmerName: "Ganesh Valvi", quantity: 25 }]);
    const fulfilled = o.offers.find((x) => x.status === "FULFILLED")!;
    expect(fulfilled.payment).toMatchObject({ status: "PAID", provider: "SIMULATED" });
    expect(o.payouts[0]).toMatchObject({ farmerName: "Ganesh Valvi", simulated: true });
  });

  test("agents list shows assigned farmers", async () => {
    const fpo = await actorFor(db, "user-fpo");
    const agents = await listAgents(db, fpo);
    const anil = agents.find((a) => a.id === "agent-anil")!;
    expect(anil.farmers.map((f) => f.name)).toEqual(expect.arrayContaining(["Sunita Gawade", "Lakshmi Bhoir", "Asha Jadhav"]));
  });
});

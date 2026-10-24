import { beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import { getSupplyOverview, sendOffer, adjustForecast } from "@/server/services/demand.service";
import { respondToOffer, respondFromChat } from "@/server/services/order.service";
import { handleFarmerMessage } from "@/server/services/assistant.service";
import { __setModelForTests } from "@/server/integrations/langchain/model";

let db: PrismaClient;
beforeAll(async () => {
  __setModelForTests(null); // CI runs the deterministic no-key assistant
  db = await createTestDb();
});

const basil = async () => (await getSupplyOverview(db)).rows.find((r) => r.ingredientId === "basil")!;

describe("café demand → farmer commitments (demo path)", () => {
  let offerId: string;

  test("forecast says basil 10 kg, nothing offered yet", async () => {
    const row = await basil();
    expect(row.suggested).toBe(10);
    expect(row.status).toBe("not_offered");
    expect(row.contributions.length).toBe(5);
    // Contributions add up to the forecast.
    const sum = row.contributions.reduce((a, c) => a + c.quantity, 0);
    expect(sum).toBeCloseTo(row.forecast, 1);
  });

  test("café manager sends the offer; matched farmers get an offer card", async () => {
    const cafe = await actorFor(db, "user-cafe");
    const { offer, notified } = await sendOffer(db, cafe, { ingredientId: "basil", fpoId: "palghar-kisan-fpo" });
    offerId = offer.id;
    expect(offer.quantity).toBe(10);
    expect(offer.status).toBe("OFFERED");
    // Ramesh and Sunita grow basil past sowing; Asha's basil is only sown.
    expect(notified.sort()).toEqual(["Ramesh Patil", "Sunita Gawade"]);
    const card = await db.message.findFirst({ where: { type: "OFFER", conversation: { farmerId: "farmer-ramesh" }, payload: { path: ["offerId"], equals: offer.id } } });
    expect(card).not.toBeNull();
    await expect(sendOffer(db, cafe, { ingredientId: "basil", fpoId: "palghar-kisan-fpo" })).rejects.toThrow(/already out/);
  });

  test("Ramesh commits 6 kg by quick reply → 4 kg open", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await respondFromChat(db, ramesh, {
      offerId, farmerId: "farmer-ramesh", action: "commit", quantity: 6, source: "CHAT", idempotencyKey: "quick-reply-ramesh-1", replyText: "मी 6 किलो देऊ शकतो",
    });
    expect(r.outcome).toMatchObject({ kind: "committed", quantity: 6, open: 4, offerStatus: "PARTIALLY_COMMITTED" });
    const row = await basil();
    expect(row.committed).toBe(6);
    expect(row.open).toBe(4);
    expect(row.status).toBe("partial");
  });

  test("a retried request with the same key changes nothing", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    const again = await respondToOffer(db, ramesh, {
      offerId, farmerId: "farmer-ramesh", action: "commit", quantity: 6, source: "CHAT", idempotencyKey: "quick-reply-ramesh-1",
    });
    expect(again.kind).toBe("duplicate");
    expect(await db.farmerCommitment.count({ where: { offerId } })).toBe(1);
    expect((await basil()).open).toBe(4);
  });

  test("Sunita can't over-commit; 4 kg via the chat assistant fills the order", async () => {
    const sunita = await actorFor(db, "user-sunita");
    const tooMuch = await respondToOffer(db, sunita, { offerId, farmerId: "farmer-sunita", action: "commit", quantity: 5, source: "CHAT" });
    expect(tooMuch).toEqual({ kind: "exceeds", open: 4 });

    const res = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "मैं ४ किलो दूँगी", source: "CHAT", clientKey: "chat-sunita-1" });
    expect(res.reply?.isDemoReply).toBe(true);
    expect(res.reply?.body).toContain("पूरा");
    const row = await basil();
    expect(row.committed).toBe(10);
    expect(row.open).toBe(0);
    expect(row.status).toBe("committed");
    const offer = await db.demandOffer.findUniqueOrThrow({ where: { id: offerId } });
    expect(offer.status).toBe("ACCEPTED");

    // Same chat message delivered twice → no second reply, no second commitment.
    const dup = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "मैं ४ किलो दूँगी", source: "CHAT", clientKey: "chat-sunita-1" });
    expect(dup.duplicate).toBe(true);
    expect(await db.farmerCommitment.count({ where: { offerId, status: "COMMITTED" } })).toBe(2);
  });

  test("a farmer can lower their commitment; the same row is updated", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await respondToOffer(db, ramesh, { offerId, farmerId: "farmer-ramesh", action: "commit", quantity: 5, source: "CHAT" });
    expect(r).toMatchObject({ kind: "committed", quantity: 5, open: 1, offerStatus: "PARTIALLY_COMMITTED" });
    expect(await db.farmerCommitment.count({ where: { offerId, farmerId: "farmer-ramesh" } })).toBe(1);
    await respondToOffer(db, ramesh, { offerId, farmerId: "farmer-ramesh", action: "commit", quantity: 6, source: "CHAT" });
    expect((await basil()).open).toBe(0);
  });

  test("adjusting is blocked once an offer is out, allowed (and audited) before", async () => {
    const cafe = await actorFor(db, "user-cafe");
    await expect(adjustForecast(db, cafe, { ingredientId: "basil", quantity: 12, reason: "Festival weekend" })).rejects.toThrow(/already out/);
    const r = await adjustForecast(db, cafe, { ingredientId: "rocket", quantity: 3, reason: "New salad special" });
    expect(r).toEqual({ from: 2.5, to: 3 });
    const row = (await getSupplyOverview(db)).rows.find((x) => x.ingredientId === "rocket")!;
    expect(row.target).toBe(3);
    expect(row.adjustments[0].reason).toBe("New salad special");
    expect(await db.auditLog.count({ where: { action: "forecast.adjusted" } })).toBe(1);
  });
});

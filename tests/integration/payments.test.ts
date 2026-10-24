import { afterEach, beforeAll, describe, expect, test } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import { sendOffer } from "@/server/services/demand.service";
import { respondToOffer } from "@/server/services/order.service";
import {
  __setCashfreeFetchForTests, createPaymentForOffer, createPayoutsForOffer, markSimulatedPaid, processCashfreeWebhook, verifyPayment,
} from "@/server/services/payment.service";
import { cashfreeSignature } from "@/server/integrations/cashfree/signature";
import { __setModelForTests } from "@/server/integrations/langchain/model";

const SECRET = "test_cf_secret";
let db: PrismaClient;
let basilOfferId: string;

function setCashfreeEnv(on: boolean) {
  if (on) {
    process.env.CASHFREE_CLIENT_ID = "test_cf_id";
    process.env.CASHFREE_CLIENT_SECRET = SECRET;
    process.env.CASHFREE_ENV = "sandbox";
  } else {
    delete process.env.CASHFREE_CLIENT_ID;
    delete process.env.CASHFREE_CLIENT_SECRET;
  }
}

function webhookHeaders(body: string, secret = SECRET) {
  const ts = String(Math.floor(Date.now() / 1000));
  return new Headers({ "x-webhook-timestamp": ts, "x-webhook-signature": cashfreeSignature(ts, body, secret) });
}

beforeAll(async () => {
  __setModelForTests(null);
  setCashfreeEnv(false);
  db = await createTestDb();
  // Demo path: basil offer fully committed (Ramesh 6 + Sunita 4).
  const cafe = await actorFor(db, "user-cafe");
  basilOfferId = (await sendOffer(db, cafe, { ingredientId: "basil", fpoId: "palghar-kisan-fpo" })).offer.id;
  await respondToOffer(db, await actorFor(db, "user-ramesh"), { offerId: basilOfferId, farmerId: "farmer-ramesh", action: "commit", quantity: 6, source: "CHAT" });
  await respondToOffer(db, await actorFor(db, "user-sunita"), { offerId: basilOfferId, farmerId: "farmer-sunita", action: "commit", quantity: 4, source: "CHAT" });
});

afterEach(() => {
  __setCashfreeFetchForTests(undefined);
  setCashfreeEnv(false);
});

describe("access control", () => {
  test("farmers can't create payments; partly committed orders aren't payable", async () => {
    const ramesh = await actorFor(db, "user-ramesh");
    await expect(createPaymentForOffer(db, ramesh, basilOfferId)).rejects.toThrow(/café managers/);
    const tomato = await db.demandOffer.findFirstOrThrow({ where: { ingredientId: "tomato", status: "PARTIALLY_COMMITTED" } });
    await expect(createPaymentForOffer(db, await actorFor(db, "user-cafe"), tomato.id)).rejects.toThrow(/full quantity/);
  });
});

describe("simulated fallback (no Cashfree credentials)", () => {
  test("simulated payment → mark paid → simulated payouts, audited as no money moved", async () => {
    const cafe = await actorFor(db, "user-cafe");
    const p = await createPaymentForOffer(db, cafe, basilOfferId);
    expect(p).toMatchObject({ provider: "SIMULATED", amount: 1800 });
    // Asking again reuses the pending payment.
    expect((await createPaymentForOffer(db, cafe, basilOfferId)).paymentId).toBe(p.paymentId);

    await expect(createPayoutsForOffer(db, cafe, basilOfferId)).rejects.toThrow(/after the café payment/);
    expect(await markSimulatedPaid(db, cafe, p.paymentId)).toEqual({ status: "PAID", changed: true });

    const r = await createPayoutsForOffer(db, cafe, basilOfferId);
    expect(r.created.map((c) => [c.farmerId, c.amount, c.status]).sort()).toEqual([
      ["farmer-ramesh", 1080, "SIMULATED"],
      ["farmer-sunita", 720, "SIMULATED"],
    ]);
    expect((await createPayoutsForOffer(db, cafe, basilOfferId)).created).toHaveLength(0);
    const logs = await db.auditLog.findMany({ where: { action: "payout.simulated", entityType: "Payout" } });
    expect(logs.length).toBeGreaterThanOrEqual(2);
    expect(JSON.stringify(logs.map((l) => l.detail))).toContain("no money moved");
    const paidLog = await db.auditLog.findFirstOrThrow({ where: { action: "payment.simulated_paid" } });
    expect(JSON.stringify(paidLog.detail)).toContain("no money moved");
  });
});

describe("Cashfree sandbox (mocked HTTP)", () => {
  let paymentId: string;
  let providerOrderId: string;

  test("creates a Cashfree order with the documented request shape", async () => {
    // Fresh order: spinach is fully committed in the seed.
    const spinach = await db.demandOffer.findFirstOrThrow({ where: { ingredientId: "spinach", status: "ACCEPTED" } });
    setCashfreeEnv(true);
    const calls: { url: string; init: RequestInit }[] = [];
    __setCashfreeFetchForTests((async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      const body = JSON.parse(String(init.body));
      return new Response(JSON.stringify({ cf_order_id: 123, order_id: body.order_id, order_status: "ACTIVE", payment_session_id: "session_abc" }), { status: 200 });
    }) as unknown as typeof fetch);

    const r = await createPaymentForOffer(db, await actorFor(db, "user-cafe"), spinach.id);
    expect(r).toMatchObject({ provider: "CASHFREE", paymentSessionId: "session_abc", mode: "sandbox", amount: 360 });
    paymentId = r.paymentId;
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://sandbox.cashfree.com/pg/orders");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers["x-client-id"]).toBe("test_cf_id");
    expect(headers["x-client-secret"]).toBe(SECRET);
    expect(headers["x-api-version"]).toBeTruthy();
    const body = JSON.parse(String(calls[0].init.body));
    expect(body).toMatchObject({ order_amount: 360, order_currency: "INR" });
    expect(body.customer_details.customer_phone).toMatch(/^\d{10}$/);
    expect(body.order_meta.return_url).toContain(`verify=${paymentId}`);
    expect(body.order_meta.notify_url).toContain("/api/webhooks/cashfree");
    providerOrderId = body.order_id;
    const stored = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(stored.status).toBe("PENDING"); // creating the order never marks it paid
  });

  test("verify maps Get Order statuses; ACTIVE stays pending", async () => {
    setCashfreeEnv(true);
    __setCashfreeFetchForTests((async () => new Response(JSON.stringify({ order_id: providerOrderId, order_status: "ACTIVE" }))) as unknown as typeof fetch);
    expect((await verifyPayment(db, await actorFor(db, "user-cafe"), paymentId)).status).toBe("PENDING");
  });

  test("webhook: bad signature rejected", async () => {
    setCashfreeEnv(true);
    const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: providerOrderId }, payment: { cf_payment_id: 999, payment_status: "SUCCESS" } } });
    expect((await processCashfreeWebhook(db, body, webhookHeaders(body, "wrong_secret"))).result).toBe("invalid_signature");
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PENDING");
  });

  test("webhook: valid success marks PAID once; duplicate delivery is a no-op", async () => {
    setCashfreeEnv(true);
    const body = JSON.stringify({ type: "PAYMENT_SUCCESS_WEBHOOK", data: { order: { order_id: providerOrderId }, payment: { cf_payment_id: 999, payment_status: "SUCCESS" } } });
    expect(await processCashfreeWebhook(db, body, webhookHeaders(body))).toMatchObject({ result: "processed", status: "PAID" });
    expect((await processCashfreeWebhook(db, body, webhookHeaders(body))).result).toBe("duplicate");
    const p = await db.payment.findUniqueOrThrow({ where: { id: paymentId } });
    expect(p.status).toBe("PAID");
    expect(p.providerPaymentId).toBe("999");
    expect(await db.webhookEvent.count({ where: { provider: "cashfree", eventId: "999" } })).toBe(1);
  });

  test("PAID is terminal: a later failure event or EXPIRED order doesn't downgrade it", async () => {
    setCashfreeEnv(true);
    const body = JSON.stringify({ type: "PAYMENT_FAILED_WEBHOOK", data: { order: { order_id: providerOrderId }, payment: { cf_payment_id: 1000, payment_status: "FAILED" } } });
    await processCashfreeWebhook(db, body, webhookHeaders(body));
    __setCashfreeFetchForTests((async () => new Response(JSON.stringify({ order_id: providerOrderId, order_status: "EXPIRED" }))) as unknown as typeof fetch);
    await verifyPayment(db, await actorFor(db, "user-cafe"), paymentId);
    expect((await db.payment.findUniqueOrThrow({ where: { id: paymentId } })).status).toBe("PAID");
  });

  test("real Cashfree payments can't be marked paid by hand", async () => {
    await expect(markSimulatedPaid(db, await actorFor(db, "user-cafe"), paymentId)).rejects.toThrow(/only be confirmed by Cashfree/);
  });
});

import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import { ApiError } from "@/lib/api";
import { appUrl, env, isConfigured } from "@/lib/env";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { canManageSupply } from "@/server/auth/access";
import { cashfreeMode, createCashfreeOrder, getCashfreeOrder } from "@/server/integrations/cashfree/client";
import { verifyCashfreeSignature } from "@/server/integrations/cashfree/signature";
import { audit } from "./audit.service";

// Café → platform collection (Cashfree PG) and platform → farmer payouts are
// separate. A payment is only marked PAID after server-side confirmation (the
// Get Order API or a signature-verified webhook) — never from a redirect.
// Without credentials the payment is SIMULATED and labelled as such.

type Status = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

let fetchOverride: typeof fetch | undefined;
/** Test hook: route Cashfree HTTP calls through a mock. */
export function __setCashfreeFetchForTests(f: typeof fetch | undefined) {
  fetchOverride = f;
}
const cfFetch = () => fetchOverride ?? fetch;

const round2 = (n: number) => Math.round(n * 100) / 100;

function assertCanCollect(actor: Actor) {
  if (!canManageSupply(actor)) throw new ApiError(403, "forbidden", "Only café managers can manage payments.");
}

/** Order status (Get Order API) → our status. */
export function mapOrderStatus(orderStatus: string): Status {
  switch (orderStatus.toUpperCase()) {
    case "PAID":
      return "PAID";
    case "EXPIRED":
    case "TERMINATED":
    case "TERMINATION_REQUESTED":
      return "CANCELLED";
    default:
      return "PENDING"; // ACTIVE etc.
  }
}

/** Payment status in a webhook → our status. */
export function mapPaymentStatus(paymentStatus: string): Status {
  switch (paymentStatus.toUpperCase()) {
    case "SUCCESS":
      return "PAID";
    case "FAILED":
      return "FAILED";
    case "USER_DROPPED":
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

/** PAID is terminal; anything else may move. */
function canTransition(from: Status, to: Status) {
  if (from === to) return false;
  return from !== "PAID";
}

async function offerAmount(db: Db | Prisma.TransactionClient, offerId: string) {
  const offer = await db.demandOffer.findUnique({ where: { id: offerId }, include: { commitments: true, ingredient: true } });
  if (!offer) throw new ApiError(404, "not_found", "Order not found.");
  const committed = offer.commitments.filter((c) => c.status === "COMMITTED").reduce((a, c) => a + c.quantity, 0);
  return { offer, committed: round2(committed), amount: Math.round(committed * offer.pricePerKg) };
}

export async function createPaymentForOffer(db: Db, actor: Actor, offerId: string) {
  assertCanCollect(actor);
  const { offer, committed, amount } = await offerAmount(db, offerId);
  if (offer.status !== "ACCEPTED" && offer.status !== "FULFILLED") {
    throw new ApiError(409, "not_payable", "Payment opens once farmers have committed the full quantity.");
  }
  if (amount <= 0) throw new ApiError(409, "nothing_to_pay", "No committed quantity to pay for.");

  const existing = await db.payment.findFirst({ where: { offerId, status: { in: ["PENDING", "PAID"] } }, orderBy: { createdAt: "desc" } });
  if (existing?.status === "PAID") throw new ApiError(409, "already_paid", "This order is already paid.");
  const useCashfree = isConfigured.cashfree();
  if (existing && existing.provider === (useCashfree ? "CASHFREE" : "SIMULATED")) {
    return { paymentId: existing.id, provider: existing.provider, paymentSessionId: existing.paymentSessionId, mode: cashfreeMode(), amount: existing.amount, reused: true };
  }

  const attempt = await db.payment.count({ where: { offerId } });
  const providerOrderId = `cqr_${offerId}_${attempt + 1}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 45);

  if (!useCashfree) {
    const p = await db.payment.create({
      data: { offerId, amount, provider: "SIMULATED", providerOrderId: `sim_${providerOrderId}`, status: "PENDING" },
    });
    await audit(db, actor, "payment.created", "Payment", p.id, { amount, provider: "SIMULATED", committedKg: committed, note: "Cashfree not configured — simulated payment." });
    return { paymentId: p.id, provider: p.provider, paymentSessionId: null, mode: cashfreeMode(), amount, reused: false };
  }

  const p = await db.payment.create({ data: { offerId, amount, provider: "CASHFREE", providerOrderId, status: "PENDING" } });
  try {
    const order = await createCashfreeOrder(
      {
        orderId: providerOrderId,
        amount,
        // Demo café contact; replace with the café's billing contact in production.
        customer: { id: actor.cafeId ?? actor.id ?? "cafe", phone: "9999999999", name: actor.name },
        returnUrl: `${appUrl()}/console/supply/payments?verify=${p.id}`,
        notifyUrl: `${appUrl()}/api/webhooks/cashfree`,
        note: `${offer.ingredient.name} ${committed} kg — Coffee on QR farm order`,
      },
      cfFetch()
    );
    if (!order.payment_session_id) throw new Error("Cashfree did not return a payment session");
    await db.payment.update({
      where: { id: p.id },
      data: { paymentSessionId: order.payment_session_id, raw: order as unknown as Prisma.InputJsonValue },
    });
    await audit(db, actor, "payment.created", "Payment", p.id, { amount, provider: "CASHFREE", mode: cashfreeMode(), providerOrderId });
    return { paymentId: p.id, provider: "CASHFREE" as const, paymentSessionId: order.payment_session_id, mode: cashfreeMode(), amount, reused: false };
  } catch (err) {
    await db.payment.update({ where: { id: p.id }, data: { status: "FAILED" } });
    logger.warn("cashfree: create order failed", { error: err instanceof Error ? err.message : String(err) });
    throw new ApiError(502, "provider_error", "Cashfree couldn't create the payment. Check the integration settings and try again.");
  }
}

/** Server-side confirmation via the Get Order API. */
export async function verifyPayment(db: Db, actor: Actor, paymentId: string) {
  assertCanCollect(actor);
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new ApiError(404, "not_found", "Payment not found.");
  if (p.provider === "SIMULATED") return { status: p.status, provider: p.provider, changed: false };
  if (!isConfigured.cashfree()) throw new ApiError(409, "not_configured", "Cashfree isn't configured, so this payment can't be checked.");

  const order = await getCashfreeOrder(p.providerOrderId, cfFetch());
  const next = mapOrderStatus(order.order_status);
  const changed = canTransition(p.status, next);
  await db.payment.update({
    where: { id: p.id },
    data: { lastVerifiedAt: new Date(), raw: order as unknown as Prisma.InputJsonValue, ...(changed ? { status: next } : {}) },
  });
  if (changed) await audit(db, actor, `payment.${next.toLowerCase()}`, "Payment", p.id, { via: "get-order", orderStatus: order.order_status });
  return { status: changed ? next : p.status, provider: p.provider, changed };
}

export async function markSimulatedPaid(db: Db, actor: Actor, paymentId: string) {
  assertCanCollect(actor);
  const p = await db.payment.findUnique({ where: { id: paymentId } });
  if (!p) throw new ApiError(404, "not_found", "Payment not found.");
  if (p.provider !== "SIMULATED") throw new ApiError(409, "not_simulated", "Real payments can only be confirmed by Cashfree.");
  if (p.status === "PAID") return { status: "PAID" as const, changed: false };
  await db.payment.update({ where: { id: p.id }, data: { status: "PAID", lastVerifiedAt: new Date() } });
  await audit(db, actor, "payment.simulated_paid", "Payment", p.id, { amount: p.amount, note: "Simulated — no money moved." });
  return { status: "PAID" as const, changed: true };
}

const webhookActor = (isDemo: boolean): Actor => ({
  id: null, name: "Cashfree webhook", role: "ADMIN", isDemo, cafeId: null, fpoId: null, farmerId: null, fieldAgentId: null,
});

interface CashfreeWebhook {
  type?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number; payment_status?: string };
  };
}

/**
 * Signature-verified, idempotent webhook processing. Returns
 * "invalid_signature" | "duplicate" | "ignored" | "processed".
 */
export async function processCashfreeWebhook(db: Db, rawBody: string, headers: Headers) {
  const ok = verifyCashfreeSignature({
    rawBody,
    timestamp: headers.get("x-webhook-timestamp"),
    signature: headers.get("x-webhook-signature"),
    secret: env().CASHFREE_CLIENT_SECRET,
  });
  if (!ok) return { result: "invalid_signature" as const };

  let event: CashfreeWebhook;
  try {
    event = JSON.parse(rawBody) as CashfreeWebhook;
  } catch {
    return { result: "ignored" as const };
  }
  const orderId = event.data?.order?.order_id;
  const paymentStatus = event.data?.payment?.payment_status;
  if (!orderId || !paymentStatus) return { result: "ignored" as const };
  const eventId = String(event.data?.payment?.cf_payment_id ?? `${orderId}:${event.type ?? paymentStatus}`);

  return db.$transaction(async (tx) => {
    const seen = await tx.webhookEvent.findUnique({ where: { provider_eventId: { provider: "cashfree", eventId } } });
    if (seen) return { result: "duplicate" as const };
    await tx.webhookEvent.create({
      data: { provider: "cashfree", eventId, payload: event as unknown as Prisma.InputJsonValue, processedAt: new Date() },
    });
    const p = await tx.payment.findUnique({ where: { providerOrderId: orderId }, include: { offer: true } });
    if (!p) return { result: "ignored" as const };
    const next = mapPaymentStatus(paymentStatus);
    if (!canTransition(p.status, next)) return { result: "processed" as const, status: p.status };
    await tx.payment.update({
      where: { id: p.id },
      data: {
        status: next,
        lastVerifiedAt: new Date(),
        providerPaymentId: event.data?.payment?.cf_payment_id ? String(event.data.payment.cf_payment_id) : p.providerPaymentId,
        raw: event as unknown as Prisma.InputJsonValue,
      },
    });
    await audit(tx, webhookActor(p.offer.isDemo), `payment.${next.toLowerCase()}`, "Payment", p.id, { via: "webhook", type: event.type ?? null });
    return { result: "processed" as const, status: next };
  });
}

/**
 * One payout record per committed farmer. Real Cashfree Payouts are not
 * implemented in this MVP: with Payouts credentials the record stays
 * NOT_STARTED (an operator pays outside the app); without, it is SIMULATED.
 * Either way the audit log says no money moved through this app.
 */
export async function createPayoutsForOffer(db: Db, actor: Actor, offerId: string) {
  assertCanCollect(actor);
  const { offer } = await offerAmount(db, offerId);
  const paid = await db.payment.findFirst({ where: { offerId, status: "PAID" } });
  if (!paid) throw new ApiError(409, "not_paid", "Record farmer payouts after the café payment is confirmed.");

  const payoutsConfigured = isConfigured.cashfreePayouts();
  const created: { farmerId: string; amount: number; status: string }[] = [];
  for (const c of offer.commitments.filter((x) => x.status === "COMMITTED" && x.quantity > 0)) {
    const exists = await db.payout.findUnique({ where: { commitmentId: c.id } });
    if (exists) continue;
    const amount = Math.round(c.quantity * offer.pricePerKg);
    const status = payoutsConfigured ? "NOT_STARTED" : "SIMULATED";
    const p = await db.payout.create({
      data: {
        commitmentId: c.id,
        farmerId: c.farmerId,
        amount,
        provider: payoutsConfigured ? "cashfree-payouts" : "simulated",
        status,
        reference: payoutsConfigured ? null : `SIM-${c.id.slice(-6).toUpperCase()}`,
      },
    });
    await audit(db, actor, payoutsConfigured ? "payout.pending_manual" : "payout.simulated", "Payout", p.id, {
      farmerId: c.farmerId,
      amount,
      note: payoutsConfigured
        ? "Cashfree Payouts credentials found, but automated payouts are not implemented in this MVP — no money moved."
        : "Simulated payout — no money moved.",
    });
    created.push({ farmerId: c.farmerId, amount, status });
  }
  return { created, payoutsConfigured };
}

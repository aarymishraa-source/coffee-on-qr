import "server-only";
import type { Db } from "@/lib/db";
import { isConfigured } from "@/lib/env";
import { cashfreeMode } from "@/server/integrations/cashfree/client";

/** Orders ready for payment, their latest café payment and farmer payouts. */
export async function listPayments(db: Db) {
  const offers = await db.demandOffer.findMany({
    where: { status: { in: ["ACCEPTED", "FULFILLED"] } },
    include: {
      ingredient: true,
      fpo: true,
      commitments: { where: { status: "COMMITTED" }, include: { farmer: true, payouts: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  const rows = offers.map((o) => {
    const committed = Math.round(o.commitments.reduce((a, c) => a + c.quantity, 0) * 100) / 100;
    const p = o.payments[0] ?? null;
    return {
      offerId: o.id,
      ingredient: o.ingredient.name,
      unit: o.ingredient.unit,
      fpo: o.fpo.name,
      status: o.status,
      committed,
      pricePerKg: o.pricePerKg,
      amount: p?.amount ?? Math.round(committed * o.pricePerKg),
      payment: p && {
        id: p.id,
        status: p.status,
        provider: p.provider,
        paymentSessionId: p.status === "PENDING" ? p.paymentSessionId : null,
        lastVerifiedAt: p.lastVerifiedAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      },
      payouts: o.commitments.map((c) => ({
        farmerName: c.farmer.name,
        quantity: c.quantity,
        amount: c.payouts[0]?.amount ?? Math.round(c.quantity * o.pricePerKg),
        status: c.payouts[0]?.status ?? null,
        provider: c.payouts[0]?.provider ?? null,
      })),
    };
  });
  const auditLog = await db.auditLog.findMany({
    where: { OR: [{ action: { startsWith: "payment." } }, { action: { startsWith: "payout." } }] },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return {
    cashfree: { configured: isConfigured.cashfree(), mode: cashfreeMode(), payoutsConfigured: isConfigured.cashfreePayouts() },
    rows,
    audit: auditLog.map((a) => ({
      id: a.id,
      at: a.createdAt.toISOString(),
      actor: a.actorName,
      action: a.action,
      detail: a.detail as Record<string, unknown> | null,
    })),
  };
}

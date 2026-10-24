import "server-only";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/auth/types";
import { offerScope } from "@/server/auth/access";

/** Offers with commitments, batches and payments for the orders screen. */
export async function listOffers(db: Db, actor: Actor) {
  const offers = await db.demandOffer.findMany({
    where: offerScope(actor),
    include: {
      ingredient: true,
      fpo: true,
      commitments: { include: { farmer: true, batches: true }, orderBy: { createdAt: "asc" } },
      payments: { orderBy: { createdAt: "desc" } },
    },
    orderBy: { createdAt: "desc" },
  });
  return offers.map((o) => {
    const live = o.commitments.filter((c) => c.status === "COMMITTED");
    const committed = live.reduce((a, c) => a + c.quantity, 0);
    const delivered = o.commitments.flatMap((c) => c.batches).filter((b) => b.deliveryStatus === "DELIVERED").reduce((a, b) => a + b.quantity, 0);
    return {
      id: o.id,
      ingredient: o.ingredient.name,
      unit: o.ingredient.unit,
      fpo: o.fpo.name,
      quantity: o.quantity,
      pricePerKg: o.pricePerKg,
      status: o.status,
      neededBy: o.neededBy.toISOString(),
      sentAt: o.sentAt?.toISOString() ?? null,
      committed: Math.round(committed * 100) / 100,
      delivered: Math.round(delivered * 100) / 100,
      isDemo: o.isDemo,
      commitments: o.commitments.map((c) => ({
        id: c.id,
        farmerName: c.farmer.name,
        village: c.farmer.village,
        quantity: c.quantity,
        status: c.status,
        source: c.source,
        at: c.updatedAt.toISOString(),
      })),
      payment: o.payments[0] ? { status: o.payments[0].status, provider: o.payments[0].provider, amount: o.payments[0].amount } : null,
    };
  });
}

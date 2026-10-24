import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { verifyPayment } from "@/server/services/payment.service";

// Confirms status server-side with Cashfree's Get Order API — the browser
// returning from checkout is never treated as proof of payment.
export const POST = route(async (_req: Request, ctx: RouteContext<"/api/payments/[id]/verify">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  return ok(await verifyPayment(await getDb(), actor, id));
});

import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { markSimulatedPaid } from "@/server/services/payment.service";

export const POST = route(async (_req: Request, ctx: RouteContext<"/api/payments/[id]/simulate">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  return ok(await markSimulatedPaid(await getDb(), actor, id));
});

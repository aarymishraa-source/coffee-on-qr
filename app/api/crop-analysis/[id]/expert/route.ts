import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { requestExpertReview } from "@/server/services/crop-analysis.service";

export const POST = route(async (_req: Request, ctx: RouteContext<"/api/crop-analysis/[id]/expert">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  return ok(await requestExpertReview(await getDb(), actor, id));
});

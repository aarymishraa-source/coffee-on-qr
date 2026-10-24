import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { actOnBatch, batchActionSchema } from "@/server/services/quality.service";

// { action: "review", grade, reason } | { action: "pickup" | "in_transit" | "deliver" }
export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/batches/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER", "FPO_MANAGER"]);
  const input = await parseJson(req, batchActionSchema);
  return ok(await actOnBatch(await getDb(), actor, id, input));
});

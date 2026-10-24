import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { farmerSchema, getFarmer, updateFarmer } from "@/server/services/farmer.service";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/farmers/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  return ok(await getFarmer(await getDb(), actor, id));
});

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/farmers/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT"]);
  const input = await parseJson(req, farmerSchema);
  return ok(await updateFarmer(await getDb(), actor, id, input));
});

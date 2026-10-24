import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { getFpoOverview } from "@/server/services/farmer.service";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/fpos/[id]/overview">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER"]);
  return ok(await getFpoOverview(await getDb(), actor, id));
});

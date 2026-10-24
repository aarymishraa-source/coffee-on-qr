import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { cancelOffer } from "@/server/services/demand.service";

const schema = z.object({ reason: z.string().trim().min(3).max(300) });

export const POST = route(async (req: Request, ctx: RouteContext<"/api/demand-offers/[id]/cancel">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  const { reason } = await parseJson(req, schema);
  await cancelOffer(await getDb(), actor, id, reason);
  return ok({ cancelled: true });
});

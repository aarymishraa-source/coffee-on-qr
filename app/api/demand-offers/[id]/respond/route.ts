import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { respondFromChat, respondSchema } from "@/server/services/order.service";

const bodySchema = respondSchema.omit({ offerId: true }).extend({
  replyText: z.string().trim().min(1).max(500).optional(),
});

export const POST = route(async (req: Request, ctx: RouteContext<"/api/demand-offers/[id]/respond">) => {
  const { id } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const input = await parseJson(req, bodySchema);
  return ok(await respondFromChat(await getDb(), actor, { ...input, offerId: id }));
});

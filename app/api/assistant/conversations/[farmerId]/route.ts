import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { getConversation } from "@/server/services/conversation-view.service";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/assistant/conversations/[farmerId]">) => {
  const { farmerId } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  return ok(await getConversation(await getDb(), actor, farmerId));
});

import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { markRead } from "@/server/services/conversation-view.service";

export const POST = route(async (_req: Request, ctx: RouteContext<"/api/assistant/conversations/[farmerId]/read">) => {
  const { farmerId } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  await markRead(await getDb(), actor, farmerId);
  return ok({ read: true });
});

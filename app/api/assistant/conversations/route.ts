import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { listConversations } from "@/server/services/conversation-view.service";

export const GET = route(async () => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  return ok(await listConversations(await getDb(), actor));
});

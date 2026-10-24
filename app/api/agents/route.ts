import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { assignableAgents, listAgents } from "@/server/services/farmer.service";

// ?assignable=1 → the agents this user may assign a farmer to (registration form).
export const GET = route(async (req: Request) => {
  const assignable = new URL(req.url).searchParams.get("assignable") === "1";
  if (assignable) {
    const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT"]);
    return ok(await assignableAgents(await getDb(), actor));
  }
  const actor = await requireActor(["ADMIN", "FPO_MANAGER"]);
  return ok(await listAgents(await getDb(), actor));
});

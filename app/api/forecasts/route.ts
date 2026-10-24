import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { getSupplyOverview } from "@/server/services/demand.service";

export const GET = route(async () => {
  await requireActor(["ADMIN", "CAFE_MANAGER"]);
  return ok(await getSupplyOverview(await getDb()));
});

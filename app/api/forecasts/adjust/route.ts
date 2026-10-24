import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { adjustForecast, adjustSchema } from "@/server/services/demand.service";

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  const input = await parseJson(req, adjustSchema);
  return ok(await adjustForecast(await getDb(), actor, input));
});

import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { createPayoutsForOffer } from "@/server/services/payment.service";

const schema = z.object({ offerId: z.string().min(1) });

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  const { offerId } = await parseJson(req, schema);
  return ok(await createPayoutsForOffer(await getDb(), actor, offerId));
});

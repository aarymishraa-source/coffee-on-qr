import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { sendOffer, sendOfferSchema } from "@/server/services/demand.service";
import { listOffers } from "@/server/services/orders-view.service";

export const GET = route(async () => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER", "FPO_MANAGER", "FIELD_AGENT"]);
  return ok(await listOffers(await getDb(), actor));
});

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  const input = await parseJson(req, sendOfferSchema);
  const { offer, notified } = await sendOffer(await getDb(), actor, input);
  return ok({ offerId: offer.id, quantity: offer.quantity, notified });
});

import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { createPaymentForOffer } from "@/server/services/payment.service";
import { listPayments } from "@/server/services/payments-view.service";

export const GET = route(async () => {
  await requireActor(["ADMIN", "CAFE_MANAGER"]);
  return ok(await listPayments(await getDb()));
});

const schema = z.object({ offerId: z.string().min(1) });

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "CAFE_MANAGER"]);
  const { offerId } = await parseJson(req, schema);
  return ok(await createPaymentForOffer(await getDb(), actor, offerId));
});

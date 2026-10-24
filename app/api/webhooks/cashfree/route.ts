import { getDb } from "@/lib/db";
import { fail, ok, route } from "@/lib/api";
import { processCashfreeWebhook } from "@/server/services/payment.service";

// Cashfree PG webhook (notify_url). Signature is checked on the raw body;
// repeated deliveries are acknowledged without reprocessing.
export const POST = route(async (req: Request) => {
  const raw = await req.text();
  const r = await processCashfreeWebhook(await getDb(), raw, req.headers);
  if (r.result === "invalid_signature") return fail(401, "bad_signature", "Signature check failed.");
  return ok(r);
});

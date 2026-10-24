import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { handleFarmerMessage, sendMessageSchema } from "@/server/services/assistant.service";

// A farmer's text message (typed by the farmer, or by their field agent on
// their behalf) → stored → assistant reply.
export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const input = await parseJson(req, sendMessageSchema);
  const r = await handleFarmerMessage(await getDb(), actor, { ...input, source: "CHAT" });
  return ok({ inboundId: r.inbound.id, replyId: r.reply?.id ?? null, duplicate: r.duplicate });
});

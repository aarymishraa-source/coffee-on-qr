import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { assertFarmerAccess } from "@/server/auth/access";
import { audit } from "@/server/services/audit.service";

const schema = z.object({ language: z.enum(["en", "hi", "mr"]) });

// The chat header's language switch: sets the farmer's preferred reply language.
export const POST = route(async (req: Request, ctx: RouteContext<"/api/assistant/conversations/[farmerId]/language">) => {
  const { farmerId } = await ctx.params;
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const { language } = await parseJson(req, schema);
  const db = await getDb();
  await assertFarmerAccess(db, actor, farmerId);
  await db.farmer.update({ where: { id: farmerId }, data: { language } });
  await audit(db, actor, "farmer.language_changed", "Farmer", farmerId, { language });
  return ok({ language });
});

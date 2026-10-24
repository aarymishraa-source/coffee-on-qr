import { getDb } from "@/lib/db";
import { ok, parseJson, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { createFarmer, farmerFilterSchema, farmerSchema, listFarmers } from "@/server/services/farmer.service";

export const GET = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT", "FARMER"]);
  const sp = new URL(req.url).searchParams;
  const filter = farmerFilterSchema.parse({
    q: sp.get("q") || undefined,
    crop: sp.get("crop") || undefined,
    stage: sp.get("stage") || undefined,
    language: sp.get("language") || undefined,
  });
  return ok(await listFarmers(await getDb(), actor, filter));
});

export const POST = route(async (req: Request) => {
  const actor = await requireActor(["ADMIN", "FPO_MANAGER", "FIELD_AGENT"]);
  const input = await parseJson(req, farmerSchema);
  return ok(await createFarmer(await getDb(), actor, input), { status: 201 });
});

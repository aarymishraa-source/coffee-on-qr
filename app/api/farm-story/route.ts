import { z } from "zod";
import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { getFarmStory } from "@/server/services/quality.service";

// Public (customer menu): only delivered, reviewed batches from farmers who
// consented to Farm Story. Returns null when there's nothing to show.
export const GET = route(async (req: Request) => {
  const dishId = z.string().min(1).max(100).parse(new URL(req.url).searchParams.get("dishId"));
  return ok(await getFarmStory(await getDb(), dishId));
});

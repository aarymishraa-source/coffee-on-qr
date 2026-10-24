import { getDb } from "@/lib/db";
import { ApiError, ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { seedDemoData } from "@/server/demo/seed";

// Restores the seeded demo records. Only rows flagged isDemo are deleted —
// real (non-demo) records are never touched. Demo accounts and admins only.
export const POST = route(async () => {
  const actor = await requireActor();
  if (!actor.isDemo && actor.role !== "ADMIN") throw new ApiError(403, "forbidden", "Only demo accounts or admins can reset demo data.");
  const db = await getDb();
  await seedDemoData(db);
  return ok({ reset: true });
});

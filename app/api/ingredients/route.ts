import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";

/** Farm-sourced ingredients — the crops a farmer can grow for café orders. */
export const GET = route(async () => {
  await requireActor();
  const db = await getDb();
  const rows = await db.ingredient.findMany({ where: { farmSourced: true }, orderBy: { name: "asc" } });
  return ok(rows.map((i) => ({ id: i.id, name: i.name, nameHi: i.nameHi, nameMr: i.nameMr, unit: i.unit })));
});

import { getDb } from "@/lib/db";
import { ok, route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";

export const GET = route(async () => {
  const actor = await requireActor();
  const db = await getDb();
  const where = actor.role === "ADMIN" || actor.role === "CAFE_MANAGER" ? {} : { id: actor.fpoId ?? "__none__" };
  const fpos = await db.fpo.findMany({ where, include: { _count: { select: { farmers: true } } }, orderBy: { name: "asc" } });
  return ok(fpos.map((f) => ({ id: f.id, name: f.name, district: f.district, farmers: f._count.farmers })));
});

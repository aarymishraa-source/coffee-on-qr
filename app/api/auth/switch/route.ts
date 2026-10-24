import { z } from "zod";
import { getDb } from "@/lib/db";
import { ApiError, ok, parseJson, route } from "@/lib/api";
import { createSession, requireActor } from "@/server/auth/session";
import { ROLE_HOME } from "@/server/auth/types";

// Presenter role switcher: only between demo accounts, only from a demo account.
const schema = z.object({ userId: z.string().min(1) });

export const POST = route(async (req: Request) => {
  const actor = await requireActor();
  const { userId } = await parseJson(req, schema);
  if (!actor.isDemo) throw new ApiError(403, "forbidden", "Role switching is only available on demo accounts.");
  const db = await getDb();
  const target = await db.user.findUnique({ where: { id: userId } });
  if (!target?.isDemo) throw new ApiError(404, "not_found", "Demo account not found.");
  await createSession(target.id);
  return ok({ name: target.name, role: target.role, home: ROLE_HOME[target.role] });
});

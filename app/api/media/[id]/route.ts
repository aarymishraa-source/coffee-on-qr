import { getDb } from "@/lib/db";
import { route } from "@/lib/api";
import { requireActor } from "@/server/auth/session";
import { assertMediaAccess, readMediaBytes } from "@/server/services/media.service";

export const GET = route(async (_req: Request, ctx: RouteContext<"/api/media/[id]">) => {
  const { id } = await ctx.params;
  const actor = await requireActor();
  const db = await getDb();
  await assertMediaAccess(db, actor, id);
  const { bytes, mimeType } = await readMediaBytes(db, id);
  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": mimeType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
});

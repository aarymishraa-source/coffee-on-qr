import "server-only";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { Db } from "@/lib/db";
import type { Actor } from "@/server/auth/types";

type Tx = Db | Prisma.TransactionClient;

export async function audit(
  db: Tx,
  actor: Actor,
  action: string,
  entityType: string,
  entityId: string,
  detail?: Prisma.InputJsonValue
) {
  await db.auditLog.create({
    data: {
      actorId: actor.id,
      actorName: actor.name,
      actorRole: actor.role,
      action,
      entityType,
      entityId,
      detail,
      isDemo: actor.isDemo,
    },
  });
}

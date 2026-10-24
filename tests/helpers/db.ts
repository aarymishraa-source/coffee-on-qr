import { PGlite } from "@electric-sql/pglite";
import { PrismaPGlite } from "pglite-prisma-adapter";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { MIGRATIONS } from "@/lib/generated/migrations";
import { __setDbForTests, splitSql } from "@/lib/db";
import { seedDemoData } from "@/server/demo/seed";
import type { Actor } from "@/server/auth/types";

/** A fresh in-memory Postgres (PGlite) with migrations applied and demo data seeded. */
export async function createTestDb(): Promise<PrismaClient> {
  const pg = await PGlite.create();
  const db = new PrismaClient({ adapter: new PrismaPGlite(pg) });
  for (const m of MIGRATIONS) for (const s of splitSql(m.sql)) await db.$executeRawUnsafe(s);
  await seedDemoData(db);
  __setDbForTests(db);
  return db;
}

export async function actorFor(db: PrismaClient, userId: string): Promise<Actor> {
  const u = await db.user.findUniqueOrThrow({ where: { id: userId } });
  return { id: u.id, name: u.name, role: u.role, isDemo: u.isDemo, cafeId: u.cafeId, fpoId: u.fpoId, farmerId: u.farmerId, fieldAgentId: u.fieldAgentId };
}

import "server-only";
import { PrismaClient } from "@/lib/generated/prisma/client";
import { MIGRATIONS } from "@/lib/generated/migrations";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";

// One Prisma client per process.
// - DATABASE_URL set → real PostgreSQL through @prisma/adapter-pg.
// - Not set → embedded PGlite (Postgres compiled to WASM). Persisted under
//   the OS temp dir locally (outside the project, so the dev file-watcher
//   doesn't reload on every write); in-memory on serverless hosts. Demo use only.
// Either way an empty database is migrated and seeded with demo data on first
// use, so a fresh deploy works without a manual seed step.

export type Db = PrismaClient;

type Holder = { db?: Promise<PrismaClient>; mode?: "postgres" | "embedded" };
const g = globalThis as unknown as { __cqrDb?: Holder };
const holder: Holder = (g.__cqrDb ??= {});

export function dbMode(): "postgres" | "embedded" {
  return env().DATABASE_URL ? "postgres" : "embedded";
}

async function createClient(): Promise<PrismaClient> {
  const url = env().DATABASE_URL;
  if (url) {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    holder.mode = "postgres";
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { PrismaPGlite } = await import("pglite-prisma-adapter");
  let dataDir = "memory://";
  if (!env().VERCEL) {
    const [{ mkdirSync }, { tmpdir }, { join }] = await Promise.all([import("node:fs"), import("node:os"), import("node:path")]);
    dataDir = process.env.PGLITE_DIR ?? join(tmpdir(), "coffee-on-qr-pglite");
    mkdirSync(dataDir, { recursive: true });
  }
  const pg = await PGlite.create(dataDir);
  holder.mode = "embedded";
  return new PrismaClient({ adapter: new PrismaPGlite(pg) });
}

async function ensureSchema(db: PrismaClient) {
  const rows = await db.$queryRawUnsafe<{ exists: string | null }[]>(
    `SELECT to_regclass('public."User"')::text AS exists`
  );
  if (rows[0]?.exists) return;
  logger.info("db: empty database — applying migrations and seeding demo data");
  for (const m of MIGRATIONS) {
    // Prisma's raw API runs one statement at a time.
    for (const stmt of splitSql(m.sql)) await db.$executeRawUnsafe(stmt);
  }
  const { seedDemoData } = await import("@/server/demo/seed");
  await seedDemoData(db);
}

/** Splits migration SQL on statement boundaries (no functions/DO blocks in our migrations). */
export function splitSql(sql: string): string[] {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean);
}

export function getDb(): Promise<PrismaClient> {
  holder.db ??= (async () => {
    const db = await createClient();
    await ensureSchema(db);
    return db;
  })().catch((err) => {
    holder.db = undefined;
    throw err;
  });
  return holder.db;
}

/** Test hook: use a specific client (e.g. a fresh in-memory PGlite). */
export function __setDbForTests(db: PrismaClient | undefined) {
  holder.db = db ? Promise.resolve(db) : undefined;
}

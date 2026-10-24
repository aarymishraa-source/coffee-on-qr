import "dotenv/config";
import { defineConfig } from "prisma/config";

// DATABASE_URL is only needed for `prisma migrate deploy` against a real
// Postgres. Local dev without Postgres uses embedded PGlite (see lib/db.ts).
export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx --conditions=react-server prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL ?? "postgresql://placeholder:placeholder@localhost:5432/placeholder",
  },
});

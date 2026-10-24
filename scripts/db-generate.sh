#!/usr/bin/env sh
# Regenerates the Prisma client and the init migration from schema.prisma
# (pre-release: a single init migration). Then embeds migrations for lib/db.ts.
set -e
npx prisma generate
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/migrations/20261024000000_init/migration.sql
npx tsx scripts/embed-migrations.ts

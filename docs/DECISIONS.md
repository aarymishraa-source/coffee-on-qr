# Decisions

One line each, newest last.

- Kisan Sahayak lives inside the existing Next.js app (root-level `app/`, `components/`, `lib/` kept; new `features/`, `server/`, `prisma/`, `tests/`, `docs/`) rather than a separate portal — one app, one design system, one source of truth.
- Existing `/`, `/app`, `/console`, `/demo` stay public and client-only (Zustand); only the new `/console/supply/*`, `/console/settings/*` and `/kisan/*` routes require sign-in.
- Database: PostgreSQL via Prisma 7 + `@prisma/adapter-pg` when `DATABASE_URL` is set; otherwise embedded PGlite (Postgres in WASM) so the app runs with zero setup. PGlite lives in the OS temp dir locally (inside the repo it triggered dev-server reload loops) and in memory on Vercel — demo only, not shared across serverless instances.
- An empty database is migrated and seeded automatically on first use (`lib/db.ts`), so a fresh deploy needs no manual seed.
- Café sales history lives in `SalesOrder`/`SalesOrderItem` (the customer app in this repo has no order backend). `server/repositories/sales.repository.ts` is the single adapter to swap for the live Coffee on QR orders API.
- Menu items reuse the customer app's dish ids from `lib/seed.ts`; three kitchen-only dishes (Tomato Basil Soup, Margherita Toast, Basil Pesto Pasta) were added so basil demand is realistic across 3 cafés.
- Sales history is anchored to fixed dates (20 Sep–24 Oct 2026) with a seeded PRNG so the forecast is deterministic: basil = 10 kg every reset.
- Forecast: 14-day moving average × trend (7d/14d, clamped ±10%) × weekday index (28d), + 10% buffer for perishables, − stock, rounded up to 0.5 kg packs.
- Paneer and milk are `farmSourced = false` — shown in the forecast but never offered to FPOs.
- Auth: own JWT session cookie (jose, HS256) + bcrypt, not NextAuth — fewer moving parts for seeded demo accounts. Without `AUTH_SECRET` a fixed dev secret is used and flagged on the integrations page.
- Next 16 `proxy.ts` only checks a session exists; roles are enforced in pages (`requirePage`) and again in every API route/service.
- shadcn/ui components are generated into `components/shadcn/` (lowercase files would collide with the existing `components/ui/Button.tsx` on case-insensitive filesystems). shadcn token names are mapped onto the brand palette in `globals.css`; the one `bg-muted` usage was changed to `bg-paper` because `muted` is already the brand's text grey.
- npm registry.npmjs.org was unreachable from the build machine; packages were installed via the npmmirror registry and the lockfile URLs rewritten back to registry.npmjs.org.
- Commitments: one row per (offer, farmer); a repeat reply updates it. Idempotency keys are recorded in `WebhookEvent` (provider `offer-response`) inside the same transaction, and the offer row is locked `FOR UPDATE`.

# Environment setup

## Local (no setup)

```bash
npm install          # also runs prisma generate + embeds migrations
npm run dev          # http://localhost:3000
```

With no `DATABASE_URL`, an embedded Postgres (PGlite) is created in your OS temp folder (`coffee-on-qr-pglite`), migrated and seeded with demo data on the first request. Override the location with `PGLITE_DIR`. Don't run `npm run demo:reset` while `npm run dev` is running against the same embedded database — use the in-app reset instead.

## With PostgreSQL

```bash
cp .env.example .env.local      # set DATABASE_URL and AUTH_SECRET
npm run db:deploy               # prisma migrate deploy
npm run db:seed                 # demo records (optional — an empty DB seeds itself)
npm run dev
```

Schema changes: edit `prisma/schema.prisma`, then `npm run db:generate` (regenerates the client and the init migration — pre-release, single migration).

## Vercel

Set at least `DATABASE_URL` (any Postgres: Neon, Supabase, Vercel Postgres, Prisma Postgres) and `AUTH_SECRET`, then deploy. The build runs `prisma generate` and `next build`; the first request migrates and seeds an empty database.

Without `DATABASE_URL` the app still runs on Vercel using an in-memory database per serverless instance — fine for a quick look, **not** for a demo: state can differ between requests and resets on cold starts.

## Optional providers

All variables are listed in `.env.example`. Status is visible to admins at `/console/settings/integrations` (Connected / Demo fallback / Not configured). Secrets are read only on the server; none use `NEXT_PUBLIC_`.

| Feature | Variables |
|---|---|
| Assistant + vision | `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` or `GOOGLE_API_KEY` (+ optional `*_MODEL`) |
| Speech | `SARVAM_API_KEY` (preferred for hi/mr) or `OPENAI_API_KEY` |
| Images | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| WhatsApp | see `docs/whatsapp-setup.md` |
| Cashfree | see `docs/cashfree-setup.md` |

## Tests

```bash
npm test                                   # Vitest: unit + integration (in-memory PGlite, mocked providers)
npm run build && npm start                 # production server on :3000
BASE_URL=http://localhost:3000 npm run test:e2e   # Playwright: the 9-step demo path
npm run selfcheck                          # existing Coffee on QR logic checks
```

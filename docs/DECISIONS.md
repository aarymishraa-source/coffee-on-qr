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
- The chat is shown from the farmer's side (their messages on the right). Field agents and FPO managers type on a farmer's behalf ("agent-assisted"); those messages are marked "Sent by agent".
- Without a model key the assistant is a deterministic intent matcher over the same business tools; every such reply is flagged `isDemoReply` ("Demo reply"). A model error also falls back to it.
- Agricultural guidance comes only from a small curated, non-chemical knowledge file labelled "Kisan Sahayak general crop-care notes (not an official advisory)" — no ICAR/KVK claims, no doses.
- Crop photos under 12 KB are treated as unusable (ask for a clearer photo) rather than guessed at.
- Sample "leaf" and "harvest" photos for the demo are SVG illustrations rendered to JPEG (`scripts/make-demo-images.mjs`), not real crop photos.
- Media bytes are stored in the database when Cloudinary isn't configured (works on any host); Cloudinary uploads are signed and `authenticated`.
- Speech: Sarvam AI preferred for Hindi/Marathi, OpenAI as fallback; with neither, the browser's Web Speech API transcribes during recording and the transcript is labelled "Transcribed in browser". No transcript → the farmer is asked to type; nothing is invented.
- Farmer payouts are recorded as simulated only; real Cashfree Payouts disbursement isn't implemented even when payout keys exist.
- WhatsApp templates (needed to message farmers outside the 24-hour window) are not implemented; offers reach farmers through the portal, or over WhatsApp within the window.
- The supply headline follows the ingredient with offer activity in the last 2 hours, so a just-filled order stays in view during the demo.
- The existing console's "Demand forecast" tab links to the new supply forecast instead of "Coming in pilot".
- The assistant agent returns its final answer through a tool call (`toolStrategy`), not provider JSON mode: Gemini 2.x rejects JSON mode combined with function calling. Model-facing schemas avoid nullable unions and exclusive bounds (Gemini rejects them); values are validated after parsing instead.
- `GEMINI_API_KEY` is accepted as an alias for `GOOGLE_API_KEY`. A failed model call falls back to the demo assistant with a 45 s timeout, and the reply is labelled "Demo reply · AI unavailable (reason)"; only the error category is stored, the provider message goes to the server log.

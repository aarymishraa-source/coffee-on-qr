# CLAUDE.md — Coffee on QR · AI FoodTech Demo

> Team SnackOverflow · ADAPPT 5.0 (IETE-SF, MPSTME) · Domain: AI in FoodTech
> **Round 1 deadline: 19 Oct 2026, 5:00 PM IST.** This app exists to be screen-recorded for a 2–3 min pitch video and opened live by judges from a QR code.

---

## 0. How to work with me (read first)

- **Read every file in `/design` before writing any code.** It has the app design PDF (8 pages: brand, 4 customer screens, manager console) and the pitch deck. The UI must look like those screens. When unsure, open the PDF page again and match it.
- **Build in the phases in §10, one at a time.** After each phase:
  1. run `npm run build` and fix every error and type error,
  2. tell me in 3–5 bullets what to open and check in the browser,
  3. **stop and wait** for my "go".
- Never leave the app broken between phases. Small, working increments.
- Commit with git after each approved phase (`feat: phase N — …`).
- Prefer simple, readable code over clever abstractions. This is a demo, not production.
- If a requirement here conflicts with the design PDF, **the design PDF wins on visuals, this file wins on behaviour.**
- Ask me only if something is truly blocking. Otherwise make the sensible choice and note it.

---

## 1. The product in one minute

**Coffee on QR is a real, live product**: QR menu, digital ordering, loyalty (Brew points), CRM and WhatsApp engagement, running in **4 cafés** (₹50,000 revenue, 100+ creators, 10+ workshops). We are adding an **AI food-intelligence layer** on top of it.

Three features, one closed loop:

| Feature | What it does | Who sees it |
|---|---|---|
| **Taste Match** | Customer swipes on *ingredients* (not dishes). Dishes from all partner cafés are ranked by taste fit, budget, diet and **live stock**. | Customer |
| **Thermal Debt** | In-house sensor logs temperature over time. We track **cumulative time–temperature exposure** per batch — not just one snapshot reading — and gate what can be sold. | Café staff only |
| **Second Serve** | Food forecast to go unsold becomes a discounted offer — **only if** the safety gate passes **and** the manager approves — sent only to **matched, opted-in** customers. | Manager approves → customer receives |

**The loop:** Sensor history → Safety / eligibility gate → Demand forecast → Manager approval → Matched offer → Reserve & learn.

**Taglines:** "Taste, matched. Freshness, measured. Nothing wasted." · "Quality gates the offer. Customer preferences target it." · "Discover better. Monitor smarter. Recover value."

**The demo must prove one thing:** this loop is real and connected, and safety always comes before sales.

---

## 2. Tech stack

- **Next.js (App Router) + TypeScript + Tailwind CSS** (use what `create-next-app` gives; define design tokens as CSS variables / Tailwind theme)
- **Zustand** — one shared store, persisted to `localStorage`, with a `resetDemo()` action
- **Framer Motion** — swipe cards, list re-ordering, toasts, number count-ups
- **lucide-react** — all icons (no emoji as icons)
- **Recharts** or hand-made SVG — the forecast and temperature charts
- `next/font/google` — Bricolage Grotesque, Geist, Geist Mono
- **No backend, no auth, no external APIs, no env vars.** All data lives in `lib/seed.ts`.
- Must deploy to **Vercel** with zero config.

---

## 3. Design system

### Colours
| Token | Hex | Use |
|---|---|---|
| `espresso` | `#18211A` | dark surfaces, primary text, primary buttons |
| `forest` | `#2E4A2C` | brand green, dark cards, dish hero bg |
| `matcha` | `#A8C47A` | accent, "within limits", highlights, active states |
| `oat` | `#FBFAF5` | cards / surfaces |
| `crema` | `#C2702E` | warm accent, **Warning** status, offer image bg |
| `signal` | `#B43A2E` | **Blocked**, danger, ✕ button |
| `paper` | `#F3F1EA` | page background |
| `line` | `#E4E0D3` | borders, dividers |
| `muted` | `#6B6F66` | secondary text |

Status chip tints: within limits = matcha at ~25% opacity with forest text; warning = crema ~20% with crema-dark text; blocked = signal ~15% with signal text; unknown = neutral grey with muted text.

### Type
- **Bricolage Grotesque** (700–800, tight letter-spacing ≈ -0.03em): page titles, dish names, prices, big KPI numbers, brand moments.
- **Geist**: all UI and body text.
- **Geist Mono**: temperatures (`4.2°C`), timers (`01:49:58`), batch IDs (`#S118`), match badges (`96% match`), small UPPERCASE section labels with wide tracking (`INGREDIENTS`, `PICK UP`, `WHY YOU'RE SEEING THIS`).

### Shape & feel
- Radius: cards `rounded-2xl`, phone/panels `rounded-3xl`, chips and buttons fully rounded pills.
- 1px `line` borders, almost no shadow (phone frame gets one soft large shadow).
- Lots of whitespace, calm and premium, Indian café context. Prices always as `₹220`.
- **No stock photos.** Use flat illustrated SVGs like the design: leaf in a circle for ingredients, simple isometric sandwich for dishes, solid colour tiles (forest / crema / matcha) for dish thumbnails.

### Logo
Rounded-square `forest` tile with a matcha-outlined rounded "S" glyph inside (like the design). Wordmark: `coffee on qr` in lowercase Bricolage, with **"on"** in matcha. Console variant adds `CAFÉ OS` in small mono below.

---

## 4. Routes

| Route | Purpose |
|---|---|
| `/` | Landing: brand panel (logo, tagline, 3 feature cards) + three big buttons: **Open demo**, **Customer app**, **Manager console**. Also shows a QR-friendly short message "Open on your phone". |
| `/app` | Customer app. On desktop: centred phone frame (≈390×844). On a real phone: full screen, no frame. |
| `/console` | Café manager console (desktop, 1440px+ ideal, must not break at 1280). |
| `/demo` | **The recording screen.** Phone on the left, console on the right, same live store. Must look perfect at **1920×1080**. |

---

## 5. Customer app (`/app`)

Bottom nav (5 tabs, lucide icons): **Home, Taste, Order, Offers, Profile**. Active tab = espresso text + bold; on the dark Second Serve screen the active tab is matcha.

### 5.1 Taste swipe (design page 4)
- Top: logo tile + "Good evening" / **"3 cafés open near you"**, filter icon button on the right.
- Title: **"What are you craving tonight?"**
- Progress bar + mono `7 / 12` (live count of swiped cards).
- Card stack (next card peeking behind, slightly rotated). Each card, `forest` bg:
  - mono label `INGREDIENT`, diet pill (`Veg` / `Non-veg`) top-right
  - illustrated circle (leaf etc.) with 3 small dots
  - big name (e.g. **Basil pesto**), flavour notes (`Herby · Nutty · Garlicky`)
  - pills: `In dishes at 3 cafés`, allergen pill (`Contains nuts`)
- Buttons: ✕ (skip, signal), `?` (not sure, small), ♥ (like, espresso circle with matcha heart).
- **Drag to swipe** (right = like, left = skip) with rotation + a "LIKE"/"SKIP" stamp fading in. Buttons trigger the same animation.
- After the 12th card (or a "See my matches" button after ≥5 swipes) → go to Picked for you.

### 5.2 Picked for you (design page 5)
- Header: back button, mono `TASTE PROFILE READY`, map icon button.
- Title **"Picked for you"**, sub: "Ranked by your taste and what's actually in stock right now."
- Filter pills (toggle): **Veg only** (on by default, espresso fill), **Under ₹250**, **Less spicy**, **Open now**. Toggling re-ranks the list with a smooth layout animation.
- Dish card: colour tile thumbnail with mono badge `96% match`; dish name; price right-aligned; `Café · 0.6 km`; "why" line (e.g. "Because you liked basil pesto and paneer"); green dot + `Live · 4 left`.
- Stock is **live from the store**: if a reservation reduces stock, the count updates; 0 left → card shows "Sold out" and drops to the bottom.

### 5.3 Dish detail (design page 6)
- `forest` hero with isometric sandwich SVG, back button and heart button.
- Name + price, `The Brew Room Café · 0.6 km`.
- **"Storage monitored"** badge (matcha tint, shield icon): `Updated 6:05 PM · Prepared 10:00 AM` + info icon → small sheet: "This café's storage is monitored by sensors. Staff confirm every batch."
- **Never show temperatures, Thermal Debt, Warning or Blocked to customers.** If a batch is not offerable, the dish simply isn't offered/discounted.
- `INGREDIENTS` chips — the customer's liked ingredients are dark chips with a ♥; others are outlined.
- `Contains: nuts, dairy, gluten`.
- `PICK UP` slots: **In 15 min** (selected), 7:00 PM, 7:30 PM.
- Sticky bottom bar: "Earns **+22 Brew points**" and button **Reserve · ₹220 →** → success sheet with a pickup code (e.g. `BR-4821`) and points added.

### 5.4 Second Serve (design page 7) — dark `espresso` screen
- Header: tag icon tile + **Second Serve**, mono `1 NEW` in matcha.
- Empty state (before manager approval): "No offers right now. We'll only send you offers that match your taste and pass the café's safety checks."
- Offer card: `crema` image area with a white isometric sandwich and a dark pill **30% off**; **Veg Sandwich**, `The Brew Room Café · 0.6 km`, ~~₹220~~ **₹154**; strip `Eligible till 8:00 PM` + live mono countdown (computed from the demo clock); big button **Reserve now →**.
- `WHY YOU'RE SEEING THIS` with matcha ticks:
  - Matches your taste — paneer, roasted peppers
  - Storage checked — within configured limits
  - Approved by the café manager
- Brew points card: progress ring, **340 Brew points**, "2 more visits to a free latte".
- Footer: "You opted in to Second Serve alerts on WhatsApp. Manage"
- When a new offer arrives: slide-in animation + a WhatsApp-style notification banner at the top of the phone ("Coffee on QR: Veg Sandwich is 30% off at The Brew Room Café till 8 PM. Reply or tap to reserve.").

### 5.5 Home, Order, Profile (simple but not broken)
- **Home:** greeting, "Continue your taste profile" card, Second Serve teaser (if an offer is live), 3 nearby cafés list.
- **Order:** reservations made in this session with pickup code + status "Ready at 6:25 PM".
- **Profile:** name "Riya", liked/disliked ingredients as chips, diet = Veg, WhatsApp opt-in toggle (ON), Brew points.

---

## 6. Manager console (`/console`) — design page 8

**Sidebar (espresso):** logo + `CAFÉ OS`; items Today (active, forest pill), Batches & sensors, Second Serve offers, Demand forecast, Menu & QR, Customers & loyalty, Audit log. Bottom note box: "Decision-support only. Sensor readings indicate monitored conditions; they do not prove food is safe. Staff confirm every action."
Only **Today** must be fully built; other items can show a tidy "Coming in pilot" panel — except **Audit log**, which lists every action taken in the session (approve, skip, reserve, status change) with timestamps.

**Header:** mono `THE BREW ROOM CAFÉ · SAT 17 OCT`; title **"Good evening — 1 offer needs you."** (count is live: "Nothing needs you right now." when empty); `DEMO DATA` dashed badge; **Export report** button (downloads a small CSV of batches + offers).

**KPI row (4 cards, numbers count up when they change):**
- Recovered revenue today — **₹1,848** · "12 Second Serve orders"
- Predicted surplus — **9 units** · "Across 3 batches by close"
- Batches monitored — **12** · "1 warning · 1 blocked" (live)
- Sensor uptime — **99.2%** · "1 probe offline since 4:40 PM"

**Batches · Thermal Debt table** (subtitle: "Cumulative time–temperature exposure vs configured window"):
columns `BATCH` (name + mono `#ID · prep HH:MM`), `NOW` (mono temp), `THERMAL DEBT` (progress bar coloured by status), `WINDOW LEFT`, `STATUS` (chip). Footer note: "Sensor outages are flagged as Unknown — never green. Blocked batches are excluded from all offers." Clicking a row opens a side panel with that batch's **temperature history line chart** (dashed line at the 5°C limit, red-shaded area above it) — this is the "snapshot vs thermal debt" story from the deck.

**Sensor simulator** (card under the table, clearly labelled `DEMO · SENSOR SIMULATOR`):
- batch dropdown + temperature slider (0–15°C) + current value in mono
- **Fast-forward 30 min** button: advances the demo clock 30 min and appends a reading for every batch at its current temp
- **Probe offline** toggle per batch → status becomes Unknown
- All changes animate the bars and chips.

**Approval queue** (dark card, badge `1 PENDING`):
- Offer: **Veg Sandwich · 30% off**, **₹154**, `Batch S118 · eligible till 8:00 PM`
- three mini tiles: **6** likely unsold · **42** matched, opted in · **OK** safety gate
- buttons **Approve & send** (matcha), **Edit** (change discount 20/30/40% → price updates), **Skip**
- caption "Or reply YES on WhatsApp to publish."
- If its batch becomes Blocked/Unknown → the card turns into a red "Offer withdrawn — batch S118 failed the safety gate" state and Approve is disabled.
- After approval → card collapses into a "Sent to 42 customers · 0 reserved" live tracker.

**This week · Forecast vs actual unsold** mini bar chart (forecast = forest, actual = matcha), Mon–Sun:
forecast `[8, 5, 9, 6, 11, 8, 7]`, actual `[7, 6, 8, 4, 10, 3, null]` (Sunday not yet).

**The closed loop** strip at the bottom: 6 tiles `01 Sensor history · 02 Safety gate · 03 Demand forecast · 04 Manager approval · 05 Matched offer · 06 Learn & improve`. In `/demo`, the tile for the step currently happening glows matcha.

---

## 7. Data model & logic

### Demo clock
Everything uses a **demo clock** in the store, not the real time. Start: **Sat 17 Oct 2026, 6:10 PM IST**. It ticks in real time; the simulator can fast-forward it. Reset puts it back.

### Thermal Debt (simple, transparent — say so in the UI)
```
limit      = 5°C
debt      += max(0, temp − limit) × minutes      // unit: °C·min, per reading interval
budget     = 120 °C·min per batch (configurable)
pct        = debt / budget
status     = no reading in last 30 min  → "unknown"
           | pct ≥ 1 or demoNow ≥ saleWindowEnd → "blocked"
           | pct ≥ 0.7               → "warning"
           | else                    → "within"
windowLeft = min(saleWindowEnd − now,
                 temp > limit ? (budget − debt) / (temp − limit) minutes : ∞)
```
A batch can be offered **only** when status is `within`. Warning = staff review, never auto-offered.

### Seed batches (debt as % of budget so the bars match the design)
| ID | Name | Prep | Temp | Debt | Sale window end | Expected status / window |
|---|---|---|---|---|---|---|
| P023 | Paneer filling | 10:00 | 4.2°C | 25% | 9:10 PM | Within limits · ~3h 00m |
| S118 | Veg Sandwich | 11:00 | 5.1°C | 58% | 8:00 PM | Within limits · ~1h 50m |
| R041 | Cooked rice tray | 12:30 | 9.8°C | 84% | 9:00 PM | Warning · Review |
| C044 | Chicken tikka filling | 09:15 | 11.4°C | 100% | 7:30 PM | Blocked · Ended |
| B207 | Cold brew concentrate | 08:00 | — | — | 10:00 PM | Unknown · No data |
Seed ~8 hours of history readings per batch so the history chart looks real (S118 should show a bump around 2 PM — "temperature was high for a while" — then back to ~4–5°C).

### Cafés
The Brew Room Café (0.6 km), Urban Bean Café (1.1 km), Café 47 (1.4 km). All open.

### Ingredients (12)
Basil pesto (veg, Herby · Nutty · Garlicky, nuts), Paneer (veg, Creamy · Mild, dairy), Roasted peppers (veg, Smoky · Sweet), Chilli (veg, Hot · Bright), Mushroom (veg, Earthy · Umami), Spinach (veg, Fresh · Green), Sourdough (veg, Tangy · Chewy, gluten), Rocket (veg, Peppery), Chicken (non-veg, Savoury · Lean), Cold brew (veg, Bold · Smooth), Blueberry (veg, Sweet · Tart), Noodles (veg, Soft · Comforting, gluten).

### Dishes (with ingredients, stock, spice)
- Pesto Paneer Sandwich ₹220 · Brew Room · basil pesto, paneer, sourdough, roasted peppers, rocket · 4 left · mild
- Veg Sandwich ₹220 · Brew Room · paneer, roasted peppers, sourdough, spinach · batch S118 · 6 left · mild
- Iced Latte ₹190 · Urban Bean · cold brew · available · "Matches your 'less sweet, strong' coffee picks"
- Blueberry Muffin ₹150 · Café 47 · blueberry · 6 left · "Fits your under-₹250 budget"
- Paneer Tikka Bowl ₹220 · Brew Room · paneer, chilli, roasted peppers · spicy
- Creamy Mushroom Pasta ₹240 · Café 47 · mushroom, spinach · **contains peanuts** → warning chip "Ask staff to confirm a suitable alternative"
- Grilled Chicken Bowl ₹260 · Urban Bean · chicken, spinach · non-veg
- Chilli Garlic Noodles ₹200 · Urban Bean · noodles, chilli, mushroom · spicy

### Match score
```
score = 0.60 × (liked ingredients in dish ÷ dish ingredients)
      + 0.25 × budget fit (1 if ≤ budget, else 0.3)
      + 0.15 × availability (1 if in stock, else 0)
      − 0.40 per disliked ingredient
      → hidden if it breaks the diet filter or an allergen the user avoids
display = round(55 + score × 45) as "NN% match"
```
Before any swipes, seed Riya's profile (liked: basil pesto, paneer, roasted peppers, cold brew; diet: veg; budget ₹250) so Picked for you matches the design (96 / 91 / 84%). New swipes update the ranking live.

### Money
Second Serve price = round(₹220 × 0.7) = **₹154**. Seeded recovered revenue = 12 × ₹154 = **₹1,848**. Each new reservation adds ₹154 and +1 order, and lowers S118 stock and the "likely unsold" count.

---

## 8. `/demo` — the recording screen

Layout at 1920×1080: soft paper background, small top bar (logo · "Live demo · demo data" · **Reset demo** button · demo clock in mono). Left ≈ 34%: phone frame with `/app`. Right ≈ 66%: console (scaled to fit, no scrollbars at 1080p if possible).

**Both sides read and write the same Zustand store**, so every action shows up instantly on the other side. Add a subtle matcha "pulse" line/flash between the two sides when an event crosses over (approval → phone, reservation → console).

### The exact video flow this screen must support
1. Phone: swipe 4–5 ingredient cards → "See my matches" → Picked for you re-ranks.
2. Console: open the Veg Sandwich row → history chart shows the 2 PM bump: "a snapshot says 5.1°C, Thermal Debt remembers the afternoon".
3. Console simulator: push **Cooked rice tray** to 12°C and fast-forward → Warning → **Blocked**, KPI "1 warning · 2 blocked", audit log entry.
4. (Optional) push Veg Sandwich high → its offer shows **"Offer withdrawn"** → set it back / Reset.
5. Console: **Approve & send** the Veg Sandwich offer → loop strip lights 04→05.
6. Phone: WhatsApp-style banner drops in → Offers tab shows Second Serve card with countdown.
7. Phone: **Reserve now** → pickup code. Console: recovered revenue counts up ₹1,848 → ₹2,002, "13 orders", stock 6 → 5, loop tile 06 lights up.

### Recording helpers
- **Reset demo** restores everything (store + clock) in one click.
- Keyboard shortcuts on `/demo` only (show a small `?` legend): `R` reset, `F` fast-forward 30 min, `A` approve pending offer.
- No console errors, no hydration warnings, no layout shift.

---

## 9. Non-negotiable rules

1. Customers **never** see temperatures, debt, Warning, Blocked or Unknown — only "Storage monitored".
2. **Blocked or Unknown batches can never become offers.** Warning batches need staff review and are not offered.
3. Every offer needs **manager approval**. Offers go only to matched, **opted-in** customers.
4. Sensor outage = **Unknown, never green.**
5. All numbers are **demo data** — show the `DEMO DATA` badge; never claim real waste reduction.
6. Copy is short, warm, plain English. No lorem ipsum anywhere. Rupees as `₹`.
7. Accessible basics: buttons are real `<button>`s, visible focus, colour is never the only signal (status chips always have text).
8. Works on a real phone (`/app`) and looks perfect at 1920×1080 (`/demo`).

---

## 10. Build phases (stop after each one)

1. **Foundation** — Next.js app, fonts, colour tokens, logo component, shared UI pieces (Button, Chip, Card, StatusChip, PhoneFrame, MonoLabel), `lib/seed.ts`, `lib/store.ts` (Zustand + persist + reset + demo clock), `lib/thermal.ts`, `lib/match.ts`. Landing page `/`.
2. **Manager console** — `/console` complete: KPIs, Thermal Debt table, row history chart, simulator, approval queue (approve / edit / skip / withdrawn state), forecast chart, loop strip, audit log.
3. **Customer app** — `/app`: Taste swipe, Picked for you, Dish detail, Second Serve, Home, Order, Profile.
4. **`/demo`** — split view on the shared store, notifications, pulse effect, loop-tile highlighting, keyboard shortcuts, Reset.
5. **Polish pass** — compare every screen against `/design` side by side and fix spacing, type sizes and colours; animations; empty states; check 1920×1080 and a 390px phone; remove all console errors.
6. **Ship** — `npm run build` clean, README with 3 run steps, deploy to Vercel, give me the live URL.

### Suggested structure
```
app/
  page.tsx                 # landing
  app/page.tsx             # customer app
  console/page.tsx         # manager console
  demo/page.tsx            # split recording view
components/
  ui/                      # Button, Chip, Card, StatusChip, MonoLabel, Logo, PhoneFrame
  customer/                # TasteSwipe, PickedForYou, DishDetail, SecondServe, Home, Orders, Profile, BottomNav
  console/                 # Sidebar, KpiRow, ThermalTable, BatchHistory, SensorSimulator, ApprovalQueue, ForecastChart, LoopStrip, AuditLog
  illustrations/           # Leaf, Sandwich (isometric), etc. as SVG components
lib/
  seed.ts  store.ts  thermal.ts  match.ts  format.ts
design/                    # reference PDFs and images (read-only)
```

---

## 11. Definition of done

- [ ] `npm run build` passes with zero errors and zero TypeScript errors
- [ ] Every screen visibly matches the design PDF (colours, fonts, layout, copy)
- [ ] The full video flow in §8 works start to finish, twice in a row, with Reset in between
- [ ] Blocked / Unknown batches can never be approved or shown as offers
- [ ] `/app` is usable on a real phone; `/demo` fits 1920×1080 without scrollbars
- [ ] No console errors or warnings in the browser
- [ ] Deployed on Vercel with a working public URL

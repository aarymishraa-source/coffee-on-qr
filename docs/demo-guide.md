# Demo guide — 7 minutes

All records are demo data. With no provider keys, every simulated step is labelled on screen ("Demo reply", "Demo analysis", "Demo conversation", "Simulated").

## Demo accounts (password `demo1234`)

| Account | Role | Lands on |
|---|---|---|
| cafe@demo.coffeeonqr.in — Neha Kapoor | Café manager | `/console/supply` |
| fpo@demo.coffeeonqr.in — Meera Joshi | FPO manager | `/kisan/fpo` |
| kavita@demo.coffeeonqr.in — Kavita More | Field agent (Ramesh, Ganesh, Mohan) | `/kisan` |
| anil@demo.coffeeonqr.in — Anil Thakur | Field agent (Sunita, Lakshmi, Asha) | `/kisan` |
| ramesh@demo.coffeeonqr.in — Ramesh Patil | Farmer, Marathi, basil | `/kisan` |
| sunita@demo.coffeeonqr.in — Sunita Gawade | Farmer, Hindi, basil | `/kisan` |
| admin@demo.coffeeonqr.in — Aarav Shah | Admin | `/console/supply` |

The login page has one-click buttons for each. While signed in as any demo account, the account menu (top right) switches between them — that's the presenter's role switcher.

## Script

| Time | Who | Do | Say |
|---|---|---|---|
| 0:00 | Neha | `/console/supply` — headline "Basil: 10 kg needed next week" | "Every number here comes from the cafés' QR orders." |
| 0:45 | Neha | Review and send basil offer → "How this was calculated" | 14-day average × trend × weekday, + buffer − stock = 10 kg. "An estimate, and the manager can adjust it with a reason." |
| 1:30 | Neha | Send 10 kg offer to Palghar Kisan FPO | Matched farmers (growing basil, past sowing) get an order card. |
| 2:00 | Ramesh | `/kisan` — the offer card arrives in Marathi → Other amount → 6 → Save | Quick reply, text or voice — all update the same order. |
| 2:45 | Neha | Dashboard: 4 kg still open (updates live) | |
| 3:00 | Sunita | Type "मैं 4 किलो दूँगी" | The assistant records it; basil is fully committed. |
| 3:30 | Ramesh | Attach → Sample leaf photo (demo) → Send | Visible symptoms, possible causes with confidence, safe first steps — "never a diagnosis". Labelled demo without a key. |
| 4:15 | Ramesh | Ask a follow-up → Ask an expert | Follow-ups use the stored result; expert escalation is audited. |
| 4:45 | Ramesh | Farmer details → Log harvest → sample harvest photo | Preliminary grade A — a visual check, not a safety certificate. |
| 5:15 | Neha | Harvest batches → batch → reason → Confirm grade A → Mark delivered | Human confirms; order becomes Fulfilled. |
| 5:45 | Neha | Payments → Create simulated payment → Mark paid (simulated) → Record farmer payouts (simulated) | Collection ≠ payout. With Cashfree sandbox keys this is a real checkout, verified server-side. |
| 6:30 | Customer | `/app` → See my matches → Pesto Paneer Sandwich | "From the farm: Basil grown by Ramesh Patil, Safale · 55 km away, grade A." |
| 6:50 | Neha | Account menu → Reset demo data | Back to step 1. |

The whole path is automated in `tests/e2e/demo-path.mjs`; run it before presenting.

## Reset

- In the app: account menu → **Reset demo data** (confirmation dialog), or `/console/settings/integrations` as admin.
- CLI: `npm run demo:reset` (stop `npm run dev` first if you use the embedded database).

Reset deletes only rows flagged `isDemo` (and their children) and reseeds; reference data is upserted. Non-demo records are never touched.

## Fallbacks if something fails live

- Model or speech provider down → replies fall back to the labelled demo assistant automatically.
- Microphone blocked → Attach → Audio file, or use the quick-reply buttons.
- Cashfree unreachable → leave keys unset; the simulated path is fully labelled.

# Coffee on QR

QR menu, ordering and loyalty for cafés, plus an AI food-intelligence layer:

- **Customer app** (`/app`): Taste Match, Second Serve, Farm Story.
- **Café console** (`/console`): Thermal Debt, Second Serve approvals. `/demo` is the split recording screen.
- **Kisan Sahayak** (`/console/supply`, `/kisan`): café sales → ingredient forecast → orders to farmer groups → farmer commitments in a WhatsApp-style AI assistant (Hindi, Marathi, English) → harvest batches → payments.

## Run

```bash
npm install
npm run dev            # http://localhost:3000 — no env vars needed
```

Sign in at `/login` with a demo account (password `demo1234`), e.g. `cafe@demo.coffeeonqr.in`.

## Test

```bash
npm test               # unit + integration
npm run build && npm start
BASE_URL=http://localhost:3000 npm run test:e2e
```

## Docs

- `docs/architecture.md`: system, data flow, data model, access control, real vs simulated
- `docs/environment-setup.md`: Postgres, Vercel, providers
- `docs/demo-guide.md`: demo accounts, 7-minute script, reset
- `docs/whatsapp-setup.md`, `docs/cashfree-setup.md`
- `docs/DECISIONS.md`

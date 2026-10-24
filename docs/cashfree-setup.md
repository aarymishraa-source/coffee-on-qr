# Cashfree setup (payment gateway, sandbox first)

Coffee on QR collects money **from the café** for each fully committed farm order through Cashfree Payment Gateway. Paying **farmers** is a separate step and is **not automated** in this MVP.

## Environment

| Variable | Value |
|---|---|
| `CASHFREE_CLIENT_ID` | Sandbox App ID (Cashfree dashboard → Developers → API keys, test mode) |
| `CASHFREE_CLIENT_SECRET` | Sandbox secret key. Also used to verify webhook signatures |
| `CASHFREE_ENV` | `sandbox` (default) or `production` |
| `CASHFREE_API_VERSION` | Optional, default `2025-01-01` (sent as `x-api-version`) |
| `NEXT_PUBLIC_APP_URL` | Public base URL, used for `return_url` and `notify_url` |

All of these are server-only. Nothing goes in `NEXT_PUBLIC_*` except the app URL.

## URLs

- Return URL (set per order): `{APP_URL}/console/supply/payments?verify=<paymentId>`. The page then calls `POST /api/payments/<id>/verify`, which asks Cashfree's Get Order API for the status. **The redirect itself never marks anything paid.**
- Webhook / notify URL: `{APP_URL}/api/webhooks/cashfree`. Also add it in the dashboard (Developers → Webhooks) for payment success, failure and user-dropped events.

## Lifecycle

1. Café manager clicks **Collect ₹X with Cashfree** → server `POST /pg/orders` → `payment_session_id`.
2. Browser loads `https://sdk.cashfree.com/js/v3/cashfree.js` and opens hosted checkout.
3. Cashfree confirms through **either**:
   - the webhook. The signature is `base64(HMAC-SHA256(x-webhook-timestamp + rawBody, client secret))`, compared timing-safely. Events are stored in `WebhookEvent` (`provider = cashfree`, id = `cf_payment_id`), so retries are no-ops; **or**
   - `GET /pg/orders/{order_id}`. `PAID` → Paid, `ACTIVE` → Pending, `EXPIRED`/`TERMINATED` → Cancelled.
4. Status mapping for webhooks: `SUCCESS` → Paid, `FAILED` → Failed, `USER_DROPPED` → Cancelled. **Paid is terminal**: no later event can downgrade it.

Use Cashfree's sandbox test cards and UPI IDs from their docs ("Test data" page) to complete payments in sandbox.

## Without credentials

Payments are created as **Simulated** (provider `SIMULATED`). "Mark paid (simulated)" asks for confirmation and writes an audit entry: "Simulated — no money moved."

## Farmer payouts

"Record farmer payouts (simulated)" creates one `Payout` per committed farmer, only after the café payment is Paid. Without Cashfree Payouts credentials (`CASHFREE_PAYOUT_CLIENT_ID` / `CASHFREE_PAYOUT_CLIENT_SECRET`) the status is **Simulated**. With them, the status stays **Not sent**, because automated payouts (beneficiaries, transfers) are **not implemented** in this MVP. The audit log says no money moved either way.

## What is verified

- Tested (`tests/integration/payments.test.ts`, mocked HTTP): the create-order request shape and headers, status mapping, bad-signature rejection, idempotent webhooks, Paid being terminal, the simulated flow, payouts, and role checks.
- **Not verified against live Cashfree**: no sandbox keys were available during the build, and Cashfree's docs were not fetched. Endpoint paths, headers, the `2025-01-01` API version and the webhook signature format follow Cashfree's published PG API as we understand it. Confirm them with one sandbox payment before going live.
- The demo café contact phone (`9999999999`) is a placeholder. Replace it with the café's billing contact.

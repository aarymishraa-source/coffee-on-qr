import "server-only";
import { env } from "@/lib/env";

// Cashfree Payment Gateway (PG) REST API. Server-only: the client secret never
// reaches the browser. Shapes follow Cashfree's PG "Create Order" and
// "Get Order" APIs (x-api-version header selects the API version).
//   POST {base}/orders              → { cf_order_id, order_id, payment_session_id, order_status }
//   GET  {base}/orders/{order_id}   → { order_id, order_status: ACTIVE | PAID | EXPIRED | TERMINATED | ... }

const DEFAULT_API_VERSION = "2025-01-01";

export function cashfreeBase() {
  return env().CASHFREE_ENV === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

export function cashfreeMode(): "sandbox" | "production" {
  return env().CASHFREE_ENV === "production" ? "production" : "sandbox";
}

function headers() {
  const e = env();
  if (!e.CASHFREE_CLIENT_ID || !e.CASHFREE_CLIENT_SECRET) throw new Error("Cashfree is not configured");
  return {
    "x-client-id": e.CASHFREE_CLIENT_ID,
    "x-client-secret": e.CASHFREE_CLIENT_SECRET,
    "x-api-version": e.CASHFREE_API_VERSION ?? DEFAULT_API_VERSION,
    "Content-Type": "application/json",
    Accept: "application/json",
  };
}

export interface CreateOrderInput {
  orderId: string;
  amount: number;
  customer: { id: string; phone: string; name: string; email?: string };
  returnUrl: string;
  notifyUrl: string;
  note?: string;
}

export interface CashfreeOrder {
  cf_order_id?: string | number;
  order_id: string;
  order_status: string;
  payment_session_id?: string;
  order_amount?: number;
  [k: string]: unknown;
}

async function parse(res: Response): Promise<CashfreeOrder> {
  const json = (await res.json().catch(() => ({}))) as CashfreeOrder & { message?: string };
  if (!res.ok) throw new Error(`Cashfree request failed (${res.status}): ${json.message ?? "unknown error"}`);
  return json;
}

export async function createCashfreeOrder(input: CreateOrderInput, fetchImpl: typeof fetch = fetch): Promise<CashfreeOrder> {
  const res = await fetchImpl(`${cashfreeBase()}/orders`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: "INR",
      customer_details: {
        customer_id: input.customer.id,
        customer_phone: input.customer.phone,
        customer_name: input.customer.name,
        ...(input.customer.email ? { customer_email: input.customer.email } : {}),
      },
      order_meta: { return_url: input.returnUrl, notify_url: input.notifyUrl },
      ...(input.note ? { order_note: input.note.slice(0, 200) } : {}),
    }),
  });
  return parse(res);
}

export async function getCashfreeOrder(orderId: string, fetchImpl: typeof fetch = fetch): Promise<CashfreeOrder> {
  const res = await fetchImpl(`${cashfreeBase()}/orders/${encodeURIComponent(orderId)}`, { method: "GET", headers: headers() });
  return parse(res);
}

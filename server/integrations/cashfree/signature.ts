import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Cashfree PG webhook signature: base64(HMAC-SHA256(timestamp + rawBody, clientSecret)),
// sent as x-webhook-signature with x-webhook-timestamp. Must be computed on the raw body.
export function cashfreeSignature(timestamp: string, rawBody: string, secret: string) {
  return createHmac("sha256", secret).update(timestamp + rawBody).digest("base64");
}

export function verifyCashfreeSignature(input: {
  rawBody: string;
  timestamp: string | null;
  signature: string | null;
  secret: string | undefined;
}): boolean {
  if (!input.timestamp || !input.signature || !input.secret) return false;
  const expected = Buffer.from(cashfreeSignature(input.timestamp, input.rawBody, input.secret));
  const given = Buffer.from(input.signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

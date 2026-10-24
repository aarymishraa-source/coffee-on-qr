import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Meta signs every webhook POST with X-Hub-Signature-256: "sha256=<hex HMAC
// of the raw request body, keyed with the app secret>".
export function signWhatsAppBody(rawBody: string, appSecret: string) {
  return `sha256=${createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex")}`;
}

export function verifyWhatsAppSignature(rawBody: string, header: string | null, appSecret: string) {
  if (!header || !header.startsWith("sha256=")) return false;
  const expected = Buffer.from(signWhatsAppBody(rawBody, appSecret));
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

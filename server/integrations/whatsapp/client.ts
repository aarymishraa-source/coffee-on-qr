import "server-only";
import { env } from "@/lib/env";

// WhatsApp Business Cloud API (Meta Graph API). Server-only; credentials come
// from env and never reach the browser. Endpoints per Meta's Cloud API docs:
//   POST /{phone-number-id}/messages   send a message
//   GET  /{media-id}                    resolve a media URL
//   GET  {media-url}                    download bytes (Bearer token required)

const DEFAULT_VERSION = "v23.0";

function base() {
  return `https://graph.facebook.com/${env().WHATSAPP_API_VERSION ?? DEFAULT_VERSION}`;
}

function authHeader() {
  const token = env().WHATSAPP_TOKEN;
  if (!token) throw new Error("WHATSAPP_TOKEN is not set");
  return { Authorization: `Bearer ${token}` };
}

export async function graphSendText(to: string, body: string, fetchImpl: typeof fetch = fetch): Promise<{ id: string }> {
  const phoneId = env().WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneId) throw new Error("WHATSAPP_PHONE_NUMBER_ID is not set");
  const res = await fetchImpl(`${base()}/${phoneId}/messages`, {
    method: "POST",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { preview_url: false, body: body.slice(0, 4096) },
    }),
  });
  const json = (await res.json().catch(() => ({}))) as { messages?: { id: string }[]; error?: { message?: string } };
  if (!res.ok || !json.messages?.[0]?.id) {
    throw new Error(`WhatsApp send failed (${res.status}): ${json.error?.message ?? "unknown error"}`);
  }
  return { id: json.messages[0].id };
}

export async function graphDownloadMedia(
  mediaId: string,
  fetchImpl: typeof fetch = fetch
): Promise<{ bytes: Buffer; mimeType: string }> {
  const meta = await fetchImpl(`${base()}/${mediaId}`, { headers: authHeader() });
  const info = (await meta.json().catch(() => ({}))) as { url?: string; mime_type?: string };
  if (!meta.ok || !info.url) throw new Error(`WhatsApp media lookup failed (${meta.status})`);
  const file = await fetchImpl(info.url, { headers: authHeader() });
  if (!file.ok) throw new Error(`WhatsApp media download failed (${file.status})`);
  return { bytes: Buffer.from(await file.arrayBuffer()), mimeType: info.mime_type ?? file.headers.get("content-type") ?? "application/octet-stream" };
}

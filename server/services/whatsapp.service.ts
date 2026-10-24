import "server-only";
import type { Db } from "@/lib/db";
import { env, isConfigured } from "@/lib/env";
import { fail, ok } from "@/lib/api";
import { logger } from "@/lib/logger";
import { graphDownloadMedia, graphSendText } from "@/server/integrations/whatsapp/client";
import { verifyWhatsAppSignature } from "@/server/integrations/whatsapp/signature";
import {
  extractEvents, normalisePhone, waPayloadSchema, type WaMessage, type WaPayload, type WaStatus,
} from "@/server/integrations/whatsapp/webhook";

/** Sends a text over WhatsApp. Throws if WhatsApp isn't configured — callers check first. */
export async function sendWhatsAppText(toPhone: string, body: string) {
  if (!isConfigured.whatsapp()) throw new Error("WhatsApp is not configured");
  return graphSendText(normalisePhone(toPhone), body);
}

// ---------------------------------------------------------------------------
// Webhook
// ---------------------------------------------------------------------------

/** GET verification handshake: echo hub.challenge when the verify token matches. */
export function verifyWebhookSubscription(url: URL): Response {
  const token = env().WHATSAPP_VERIFY_TOKEN;
  const mode = url.searchParams.get("hub.mode");
  const given = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (token && mode === "subscribe" && given === token && challenge) {
    return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("Forbidden", { status: 403 });
}

/**
 * POST handler factory. Verifies X-Hub-Signature-256 over the raw body, then
 * acknowledges immediately and hands processing to `schedule` (next/server
 * `after()` in production; run inline in tests).
 */
export function createWhatsAppPostHandler(schedule: (task: () => Promise<void>) => void, getDatabase: () => Promise<Db>) {
  return async (req: Request): Promise<Response> => {
    const secret = env().WHATSAPP_APP_SECRET;
    if (!secret) return fail(503, "not_configured", "WhatsApp webhook is not configured (WHATSAPP_APP_SECRET missing).");
    const raw = await req.text();
    if (!verifyWhatsAppSignature(raw, req.headers.get("x-hub-signature-256"), secret)) {
      return fail(401, "bad_signature", "Signature check failed.");
    }
    let payload: WaPayload;
    try {
      payload = waPayloadSchema.parse(JSON.parse(raw));
    } catch {
      return fail(400, "invalid_payload", "Unrecognised webhook payload.");
    }
    schedule(async () => {
      try {
        await processWebhookPayload(await getDatabase(), payload);
      } catch (err) {
        logger.error("whatsapp: webhook processing failed", { error: err instanceof Error ? err.message : String(err) });
      }
    });
    return ok({ received: true });
  };
}

export interface ProcessOptions {
  fetchImpl?: typeof fetch;
}

export interface ProcessSummary {
  messages: number;
  duplicates: number;
  statuses: number;
  unknownSenders: number;
}

/** Processes a verified payload. Safe to call repeatedly with the same payload. */
export async function processWebhookPayload(db: Db, payload: WaPayload, opts: ProcessOptions = {}): Promise<ProcessSummary> {
  const { messages, statuses } = extractEvents(payload);
  const summary: ProcessSummary = { messages: 0, duplicates: 0, statuses: 0, unknownSenders: 0 };

  for (const m of messages) {
    if (!(await claimEvent(db, m.id, m))) {
      summary.duplicates++;
      continue;
    }
    try {
      const handled = await handleInbound(db, m, opts);
      if (handled === "unknown") summary.unknownSenders++;
      else summary.messages++;
      await markProcessed(db, m.id);
    } catch (err) {
      // Release the claim so Meta's retry can process it again.
      await db.webhookEvent.deleteMany({ where: { provider: "whatsapp", eventId: m.id } });
      throw err;
    }
  }

  for (const s of statuses) {
    const eventId = `${s.id}:${s.status}`;
    if (!(await claimEvent(db, eventId, s))) {
      summary.duplicates++;
      continue;
    }
    await applyStatus(db, s);
    await markProcessed(db, eventId);
    summary.statuses++;
  }
  return summary;
}

async function claimEvent(db: Db, eventId: string, payload: WaMessage | WaStatus): Promise<boolean> {
  try {
    await db.webhookEvent.create({ data: { provider: "whatsapp", eventId, payload: payload as object } });
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return false;
    throw err;
  }
}

async function markProcessed(db: Db, eventId: string) {
  await db.webhookEvent.update({
    where: { provider_eventId: { provider: "whatsapp", eventId } },
    data: { processedAt: new Date() },
  });
}

async function handleInbound(db: Db, m: WaMessage, opts: ProcessOptions): Promise<"handled" | "unknown" | "ignored"> {
  const phone = normalisePhone(m.from);
  const farmer = await db.farmer.findUnique({ where: { phone } });
  if (!farmer) {
    logger.warn("whatsapp: message from unknown number", { last4: phone.slice(-4) });
    await db.auditLog.create({
      data: {
        actorName: "WhatsApp webhook",
        actorRole: "SYSTEM",
        action: "whatsapp.unknown_sender",
        entityType: "WhatsAppMessage",
        entityId: m.id,
        detail: { phoneLast4: phone.slice(-4), type: m.type },
        isDemo: false,
      },
    });
    return "unknown";
  }

  // Imported lazily: these services import conversation.service, which imports this module.
  const { farmerActor, handleFarmerMessage } = await import("./assistant.service");
  const actor = await farmerActor(db, farmer.id);

  if (m.type === "text" && m.text) {
    await handleFarmerMessage(db, actor, {
      farmerId: farmer.id,
      text: m.text.body,
      source: "WHATSAPP",
      channel: "WHATSAPP",
      providerMessageId: m.id,
    });
    return "handled";
  }

  if (m.type === "image" && m.image) {
    const { saveMedia } = await import("./media.service");
    const { analyseCropPhoto } = await import("./crop-analysis.service");
    const file = await graphDownloadMedia(m.image.id, opts.fetchImpl);
    const media = await saveMedia(db, { kind: "image", mimeType: file.mimeType, bytes: file.bytes, isDemo: farmer.isDemo });
    await analyseCropPhoto(db, actor, {
      farmerId: farmer.id,
      mediaId: media.id,
      note: m.image.caption ?? null,
      channel: "WHATSAPP",
      providerMessageId: m.id,
    });
    return "handled";
  }

  if (m.type === "audio" && m.audio) {
    const { handleVoiceNote } = await import("./voice.service");
    const file = await graphDownloadMedia(m.audio.id, opts.fetchImpl);
    await handleVoiceNote(db, actor, {
      farmerId: farmer.id,
      bytes: file.bytes,
      mimeType: file.mimeType,
      channel: "WHATSAPP",
      providerMessageId: m.id,
      source: "WHATSAPP",
    });
    return "handled";
  }

  logger.info("whatsapp: ignoring unsupported message type", { type: m.type });
  return "ignored";
}

const STATUS_RANK = { PENDING: 0, SENT: 1, DELIVERED: 2, READ: 3, FAILED: 1 } as const;
type MsgStatus = keyof typeof STATUS_RANK;

async function applyStatus(db: Db, s: WaStatus) {
  const next = ({ sent: "SENT", delivered: "DELIVERED", read: "READ", failed: "FAILED" } as Record<string, MsgStatus>)[s.status];
  if (!next) return;
  const msg = await db.message.findUnique({ where: { providerMessageId: s.id } });
  if (!msg) return;
  const current = msg.status as MsgStatus;
  // Never move backwards (statuses can arrive out of order); a failure can't undo a read.
  if (next === "FAILED" ? current === "READ" : STATUS_RANK[next] <= STATUS_RANK[current]) return;
  await db.message.update({ where: { id: msg.id }, data: { status: next } });
}

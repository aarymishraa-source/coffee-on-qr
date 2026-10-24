import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { createTestDb } from "../helpers/db";
import { __setModelForTests } from "@/server/integrations/langchain/model";
import { signWhatsAppBody, verifyWhatsAppSignature } from "@/server/integrations/whatsapp/signature";
import { createWhatsAppPostHandler, processWebhookPayload } from "@/server/services/whatsapp.service";
import { waPayloadSchema } from "@/server/integrations/whatsapp/webhook";
import { GET } from "@/app/api/webhooks/whatsapp/route";

const SECRET = "test-app-secret";
let db: PrismaClient;
let sent = 0;

beforeAll(async () => {
  vi.stubEnv("WHATSAPP_TOKEN", "test-token");
  vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "1234567890");
  vi.stubEnv("WHATSAPP_VERIFY_TOKEN", "verify-me");
  vi.stubEnv("WHATSAPP_APP_SECRET", SECRET);
  // Graph API: every outbound send gets a fake wamid.
  vi.stubGlobal("fetch", vi.fn(async (url: string) => {
    if (String(url).includes("graph.facebook.com") && String(url).endsWith("/messages")) {
      sent++;
      return new Response(JSON.stringify({ messages: [{ id: `wamid.out.${sent}` }] }), { status: 200 });
    }
    return new Response("not mocked", { status: 500 });
  }));
  __setModelForTests(null);
  db = await createTestDb();
});

afterAll(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

function textPayload(id: string, from: string, body: string) {
  return {
    object: "whatsapp_business_account",
    entry: [{ id: "waba", changes: [{ field: "messages", value: { messaging_product: "whatsapp", metadata: { phone_number_id: "1234567890" }, messages: [{ from, id, timestamp: "1761300000", type: "text", text: { body } }] } }] }],
  };
}

function statusPayload(id: string, status: string) {
  return {
    object: "whatsapp_business_account",
    entry: [{ changes: [{ field: "messages", value: { statuses: [{ id, status, timestamp: "1761300100", recipient_id: "919800000001" }] } }] }],
  };
}

const inline = createWhatsAppPostHandler((task) => void task(), async () => db);

function post(body: unknown, signature?: string) {
  const raw = JSON.stringify(body);
  return new Request("http://localhost/api/webhooks/whatsapp", {
    method: "POST",
    headers: { "content-type": "application/json", "x-hub-signature-256": signature ?? signWhatsAppBody(raw, SECRET) },
    body: raw,
  });
}

describe("WhatsApp webhook", () => {
  test("GET verification echoes the challenge only with the right token", async () => {
    const okRes = await GET(new Request("http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=verify-me&hub.challenge=42"));
    expect(okRes.status).toBe(200);
    expect(await okRes.text()).toBe("42");
    const bad = await GET(new Request("http://localhost/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=42"));
    expect(bad.status).toBe(403);
  });

  test("signature helper is timing-safe and strict", () => {
    const raw = '{"a":1}';
    expect(verifyWhatsAppSignature(raw, signWhatsAppBody(raw, SECRET), SECRET)).toBe(true);
    expect(verifyWhatsAppSignature(raw, signWhatsAppBody(raw, "other"), SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(raw, null, SECRET)).toBe(false);
    expect(verifyWhatsAppSignature(raw, "sha256=short", SECRET)).toBe(false);
  });

  test("POST with a bad signature is rejected and nothing is stored", async () => {
    const before = await db.message.count();
    const res = await inline(post(textPayload("wamid.bad", "919800000001", "hi"), "sha256=deadbeef"));
    expect(res.status).toBe(401);
    expect(await db.message.count()).toBe(before);
  });

  test("a signed text message stores the farmer message and an assistant reply sent over WhatsApp", async () => {
    const res = await inline(post(textPayload("wamid.in.1", "+91 98000 00001", "When should I harvest basil in the morning?")));
    expect(res.status).toBe(200);
    // Processing is scheduled inline (fire-and-forget); let it finish.
    await vi.waitFor(async () => expect(await db.message.findUnique({ where: { providerMessageId: "wamid.in.1" } })).not.toBeNull());
    const inbound = (await db.message.findUnique({ where: { providerMessageId: "wamid.in.1" }, include: { conversation: true } }))!;
    expect(inbound.channel).toBe("WHATSAPP");
    expect(inbound.direction).toBe("IN");
    expect(inbound.conversation.farmerId).toBe("farmer-ramesh");
    await vi.waitFor(async () => {
      const reply = await db.message.findFirst({ where: { conversationId: inbound.conversationId, direction: "OUT", createdAt: { gte: inbound.createdAt } } });
      expect(reply?.channel).toBe("WHATSAPP");
      expect(reply?.providerMessageId).toMatch(/^wamid\.out\./);
      expect(reply?.status).toBe("SENT");
    });
  });

  test("the same payload delivered twice creates one inbound message", async () => {
    const payload = waPayloadSchema.parse(textPayload("wamid.in.2", "919800000002", "धन्यवाद"));
    const first = await processWebhookPayload(db, payload);
    const second = await processWebhookPayload(db, payload);
    expect(first.messages).toBe(1);
    expect(second.duplicates).toBe(1);
    expect(await db.message.count({ where: { providerMessageId: "wamid.in.2" } })).toBe(1);
    const conv = await db.conversation.findUniqueOrThrow({ where: { farmerId: "farmer-sunita" } });
    const replies = await db.message.count({ where: { conversationId: conv.id, direction: "OUT", channel: "WHATSAPP" } });
    expect(replies).toBe(1);
  });

  test("delivery and read statuses update the outbound message and never go backwards", async () => {
    const out = (await db.message.findFirst({ where: { providerMessageId: { startsWith: "wamid.out." } } }))!;
    const id = out.providerMessageId!;
    await processWebhookPayload(db, waPayloadSchema.parse(statusPayload(id, "delivered")));
    expect((await db.message.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("DELIVERED");
    await processWebhookPayload(db, waPayloadSchema.parse(statusPayload(id, "read")));
    expect((await db.message.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("READ");
    // A late "delivered" (different event id) arriving after "read" is ignored.
    await processWebhookPayload(db, waPayloadSchema.parse(statusPayload(id, "sent")));
    expect((await db.message.findUniqueOrThrow({ where: { id: out.id } })).status).toBe("READ");
    const dup = await processWebhookPayload(db, waPayloadSchema.parse(statusPayload(id, "read")));
    expect(dup.duplicates).toBe(1);
  });

  test("messages from unknown numbers are audited and not answered", async () => {
    const before = await db.message.count();
    const r = await processWebhookPayload(db, waPayloadSchema.parse(textPayload("wamid.in.3", "919999999999", "hello")));
    expect(r.unknownSenders).toBe(1);
    expect(await db.message.count()).toBe(before);
    expect(await db.auditLog.count({ where: { action: "whatsapp.unknown_sender", entityId: "wamid.in.3" } })).toBe(1);
  });
});

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import type { PrismaClient } from "@/lib/generated/prisma/client";
import { actorFor, createTestDb } from "../helpers/db";
import { handleFarmerMessage } from "@/server/services/assistant.service";
import { sendOffer } from "@/server/services/demand.service";
import { runAssistantAgent } from "@/server/assistant/agent";
import { __setModelForTests, classifyModelError, DEFAULT_MODELS, getChatModel, GOOGLE_MAX_RETRIES } from "@/server/integrations/langchain/model";
import { env, llmProvider } from "@/lib/env";

// The real Gemini client (LangChain) against a mocked Google endpoint: checks
// the request is one Gemini accepts and that replies, tool calls and failures
// are handled and labelled honestly.

type Part = { text?: string; functionCall?: { name: string; args: Record<string, unknown> } };
const geminiResponse = (parts: Part[]) =>
  new Response(JSON.stringify({ candidates: [{ content: { role: "model", parts }, finishReason: "STOP", index: 0 }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw Gemini request JSON
interface Captured { url: string; headers: Headers; body: Record<string, any> }
function mockGemini(turns: Array<(req: Captured) => Response | Promise<Response>>) {
  const requests: Captured[] = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    const req = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(String(init.body)) };
    requests.push(req);
    return turns[Math.min(requests.length - 1, turns.length - 1)](req);
  });
  return requests;
}

/** The tool LangChain adds for the structured final answer (toolStrategy). */
const answerTool = (req: Captured): string =>
  (req.body.tools?.[0]?.functionDeclarations ?? []).map((f: { name: string }) => f.name).find((n: string) => n.startsWith("extract"));

const gemini = () => new ChatGoogleGenerativeAI({ apiKey: "test-gemini-key", model: DEFAULT_MODELS.google, maxRetries: 0 });

let db: PrismaClient;
let n = 0;
const key = () => `test-assistant-${++n}-${Date.now()}`;

beforeAll(async () => {
  db = await createTestDb();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  __setModelForTests(null);
});

describe("assistant with Gemini (mocked HTTP)", () => {
  test("live reply: request is Gemini-compatible, reply and translation stored, not labelled demo", async () => {
    __setModelForTests(gemini());
    const requests = mockGemini([
      () => geminiResponse([{ functionCall: { name: "getFarmerProfile", args: {} } }]),
      (req) => geminiResponse([{ functionCall: { name: answerTool(req), args: { reply: "नमस्कार रमेश! तुमची बेसिल चांगली आहे.", farmer_message_english: "Hello, how is my basil?" } } }]),
    ]);
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await handleFarmerMessage(db, ramesh, { farmerId: "farmer-ramesh", text: "नमस्कार, माझी बेसिल कशी आहे?", source: "CHAT", clientKey: key() });

    expect(r.reply?.body).toBe("नमस्कार रमेश! तुमची बेसिल चांगली आहे.");
    expect(r.reply?.isDemoReply).toBe(false);
    expect(r.reply?.payload ?? null).toBeNull();
    const inbound = await db.message.findUniqueOrThrow({ where: { id: r.inbound.id } });
    expect(inbound.translation).toBe("Hello, how is my basil?");

    // Gemini 2.x rejects JSON mode combined with tools, JSON-Schema-only keys
    // and nullable type unions, so none may appear in the request.
    expect(requests).toHaveLength(2);
    const first = JSON.stringify(requests[0].body);
    expect(requests[0].body.generationConfig?.responseMimeType).toBeUndefined();
    expect(requests[0].body.generationConfig?.responseSchema).toBeUndefined();
    expect(first).not.toContain('"$schema"');
    expect(first).not.toContain("exclusiveMinimum");
    expect(first).not.toMatch(/"type":\[/);
    // The second turn carries the tool result back to the model.
    expect(JSON.stringify(requests[1].body)).toContain("functionResponse");
    // The key travels in a header, never in the URL or body.
    expect(requests[0].url).not.toContain("test-gemini-key");
    expect(first).not.toContain("test-gemini-key");
    expect(requests[0].headers.get("x-goog-api-key")).toBe("test-gemini-key");
  });

  test("the model's tool call records a real commitment", async () => {
    const cafe = await actorFor(db, "user-cafe");
    const { offer } = await sendOffer(db, cafe, { ingredientId: "basil", fpoId: "palghar-kisan-fpo" });
    __setModelForTests(gemini());
    mockGemini([
      () => geminiResponse([{ functionCall: { name: "respondToOffer", args: { action: "commit", quantityKg: 6 } } }]),
      (req) => geminiResponse([{ functionCall: { name: answerTool(req), args: { reply: "6 किलो नोंदवले. 4 किलो बाकी.", farmer_message_english: "I can give 6 kg" } } }]),
    ]);
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await handleFarmerMessage(db, ramesh, { farmerId: "farmer-ramesh", text: "मी 6 किलो देऊ शकतो", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(false);
    const c = await db.farmerCommitment.findFirstOrThrow({ where: { offerId: offer.id, farmerId: "farmer-ramesh" } });
    expect(c.quantity).toBe(6);
    expect(c.status).toBe("COMMITTED");
  });

  test("a rejected key falls back to the labelled demo assistant and records why", async () => {
    __setModelForTests(gemini());
    mockGemini([
      () => new Response(JSON.stringify({ error: { code: 403, message: "API key not valid. Please pass a valid API key.", status: "PERMISSION_DENIED" } }), { status: 403 }),
    ]);
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "नमस्ते", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.body.length).toBeGreaterThan(0);
    expect(r.reply?.payload).toMatchObject({ fallback: "model_error", modelError: "auth" });
    expect(JSON.stringify(r.reply?.payload)).not.toContain("test-gemini-key");
  });

  test("Gemini busy (503) is labelled busy and retried once, not until the timeout", async () => {
    // The production model from getChatModel(), so its real retry setting is exercised.
    __setModelForTests(undefined);
    for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_MODEL", "GEMINI_MODEL"]) vi.stubEnv(k, "");
    vi.stubEnv("GOOGLE_API_KEY", "test-gemini-key");
    const requests = mockGemini([
      () =>
        new Response(
          JSON.stringify({ error: { code: 503, message: "This model is currently experiencing high demand. Please try again later.", status: "UNAVAILABLE" } }),
          { status: 503 },
        ),
    ]);
    const sunita = await actorFor(db, "user-sunita");
    const started = Date.now();
    const r = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "नमस्ते", source: "CHAT", clientKey: key() });
    expect(GOOGLE_MAX_RETRIES).toBe(1);
    expect(requests).toHaveLength(1 + GOOGLE_MAX_RETRIES);
    expect(requests[0].url).toContain("gemini-3.5-flash-lite");
    expect(Date.now() - started).toBeLessThan(10_000);
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.payload).toMatchObject({ fallback: "model_error", modelError: "busy" });
  }, 15_000);

  test("a retired or unknown model is a rejected request, never a live reply", async () => {
    __setModelForTests(gemini());
    mockGemini([
      () =>
        new Response(
          JSON.stringify({ error: { code: 404, message: "This model models/gemini-old is no longer available to new users.", status: "NOT_FOUND" } }),
          { status: 404 },
        ),
    ]);
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "नमस्ते", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.payload).toMatchObject({ fallback: "model_error", modelError: "bad_request" });
  });

  test("a malformed answer (no structured reply) falls back instead of storing it", async () => {
    __setModelForTests(gemini());
    mockGemini([() => geminiResponse([{ text: "Free text instead of the required answer tool call." }])]);
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "मेरा पैसा कब आएगा?", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.payload).toMatchObject({ fallback: "model_error" });
    expect(r.reply?.body).not.toContain("Free text");
  });

  test("an empty reply from the model is treated as a failure", async () => {
    __setModelForTests(gemini());
    mockGemini([(req) => geminiResponse([{ functionCall: { name: answerTool(req), args: { reply: "  ", farmer_message_english: "hi" } } }])]);
    const sunita = await actorFor(db, "user-sunita");
    const r = await handleFarmerMessage(db, sunita, { farmerId: "farmer-sunita", text: "hello", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.body.trim().length).toBeGreaterThan(0);
  });

  test("a hung provider call times out", async () => {
    mockGemini([() => new Promise<Response>(() => {})]);
    const ramesh = await actorFor(db, "user-ramesh");
    const ctx = { db, actor: ramesh, farmerId: "farmer-ramesh", language: "mr" as const, source: "CHAT" as const, requestKey: key() };
    const err = await runAssistantAgent(ctx, gemini(), [], "hello", "Ramesh", { timeoutMs: 200 }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(Error);
    expect(classifyModelError(err)).toBe("timeout");
  });
});

describe("no model configured", () => {
  test("replies come from the demo assistant, labelled, with the reason", async () => {
    __setModelForTests(null);
    const ramesh = await actorFor(db, "user-ramesh");
    const r = await handleFarmerMessage(db, ramesh, { farmerId: "farmer-ramesh", text: "माझे पैसे?", source: "CHAT", clientKey: key() });
    expect(r.reply?.isDemoReply).toBe(true);
    expect(r.reply?.payload).toMatchObject({ fallback: "no_model_key" });
  });
});

describe("provider selection from environment", () => {
  test("GEMINI_API_KEY is accepted as the Google key", () => {
    for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY"]) vi.stubEnv(k, "");
    expect(llmProvider()).toBeNull();
    vi.stubEnv("GEMINI_API_KEY", "abc");
    expect(llmProvider()).toBe("google");
    expect(env().GOOGLE_API_KEY).toBe("abc");
    vi.stubEnv("GOOGLE_API_KEY", "preferred");
    expect(env().GOOGLE_API_KEY).toBe("preferred");
  });

  test("Google defaults to gemini-3.5-flash-lite; GOOGLE_MODEL overrides it", async () => {
    __setModelForTests(undefined);
    for (const k of ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_MODEL", "GEMINI_MODEL"]) vi.stubEnv(k, "");
    vi.stubEnv("GOOGLE_API_KEY", "abc");
    const def = await getChatModel();
    expect(def?.provider).toBe("google");
    const g = def!.model as ChatGoogleGenerativeAI;
    expect(g.model).toBe("gemini-3.5-flash-lite");
    vi.stubEnv("GOOGLE_MODEL", "gemini-custom");
    expect(((await getChatModel())!.model as ChatGoogleGenerativeAI).model).toBe("gemini-custom");
  });

  test("errors are bucketed without echoing the provider message", () => {
    expect(classifyModelError(new Error("[GoogleGenerativeAI Error]: Error fetching from https://x: [403 Forbidden] API key not valid"))).toBe("auth");
    expect(classifyModelError(new Error("[429 Too Many Requests] Resource has been exhausted (e.g. check quota)."))).toBe("quota");
    expect(classifyModelError(new Error("[400 Bad Request] Invalid JSON payload received."))).toBe("bad_request");
    expect(classifyModelError(new Error("fetch failed"))).toBe("network");
    expect(classifyModelError(new Error("[503 Service Unavailable] The model is overloaded. Please try again later."))).toBe("busy");
    expect(classifyModelError(Object.assign(new Error("high demand"), { status: 503 }))).toBe("busy");
    expect(classifyModelError(new Error("[404 Not Found] models/x is unavailable to this user"))).toBe("bad_request");
    expect(classifyModelError(new Error("[500 Internal Server Error] An internal error has occurred."))).toBe("network");
    expect(classifyModelError(Object.assign(new Error("The operation was aborted due to timeout"), { name: "TimeoutError" }))).toBe("timeout");
  });
});

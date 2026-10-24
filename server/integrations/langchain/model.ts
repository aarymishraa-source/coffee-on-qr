import "server-only";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env, llmProvider } from "@/lib/env";

// Model provider: whichever key exists (Anthropic → OpenAI → Google).
// Defaults are overridable with ANTHROPIC_MODEL / OPENAI_MODEL / GOOGLE_MODEL.
export const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
  google: "gemini-3.5-flash-lite",
} as const;

// LangChain's AsyncCaller retries 5xx/429 up to 6 times with backoff by
// default, which lets a busy Gemini (503) eat the whole agent timeout.
// One retry rides out a blip; past that, fail fast and say "busy".
export const GOOGLE_MAX_RETRIES = 1;

let override: BaseChatModel | null | undefined;

/** Test hook: force a specific model (or null for the no-key fallback). */
export function __setModelForTests(model: BaseChatModel | null | undefined) {
  override = model;
}

export async function getChatModel(): Promise<{ model: BaseChatModel; provider: string } | null> {
  if (override !== undefined) return override ? { model: override, provider: "test" } : null;
  const e = env();
  switch (llmProvider()) {
    case "anthropic": {
      const { ChatAnthropic } = await import("@langchain/anthropic");
      return {
        model: new ChatAnthropic({ apiKey: e.ANTHROPIC_API_KEY, model: e.ANTHROPIC_MODEL ?? DEFAULT_MODELS.anthropic, maxTokens: 1024 }),
        provider: "anthropic",
      };
    }
    case "openai": {
      const { ChatOpenAI } = await import("@langchain/openai");
      return { model: new ChatOpenAI({ apiKey: e.OPENAI_API_KEY, model: e.OPENAI_MODEL ?? DEFAULT_MODELS.openai }), provider: "openai" };
    }
    case "google": {
      const { ChatGoogleGenerativeAI } = await import("@langchain/google-genai");
      return {
        model: new ChatGoogleGenerativeAI({ apiKey: e.GOOGLE_API_KEY, model: e.GOOGLE_MODEL ?? DEFAULT_MODELS.google, maxRetries: GOOGLE_MAX_RETRIES }),
        provider: "google",
      };
    }
    default:
      return null;
  }
}

export type ModelErrorKind = "auth" | "quota" | "busy" | "bad_request" | "timeout" | "network" | "bad_output" | "unknown";

/**
 * Buckets a provider failure so the chat can say why a reply fell back
 * ("AI unavailable — API key rejected") without echoing provider messages,
 * which can contain request details.
 */
export function classifyModelError(err: unknown): ModelErrorKind {
  const e = err as { name?: string; status?: number; message?: string } | null;
  const msg = String(e?.message ?? err ?? "");
  const status = e?.status ?? Number(/\[(\d{3})\b/.exec(msg)?.[1] ?? /\b(4\d\d|5\d\d)\b/.exec(msg)?.[1] ?? NaN);
  if (e?.name === "TimeoutError" || e?.name === "AbortError" || /abort|timed? ?out/i.test(msg)) return "timeout";
  if (status === 401 || status === 403 || /api[_ ]?key|permission|unauthori[sz]ed|PERMISSION_DENIED|UNAUTHENTICATED/i.test(msg)) return "auth";
  if (status === 429 || /quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) return "quota";
  // Google answers 503 UNAVAILABLE ("model is overloaded" / "high demand") when it is out of capacity.
  // A 4xx (e.g. 404 "model no longer available") is never "busy", whatever its wording.
  if (status === 503 || (!(status >= 400 && status < 500) && /overloaded|high demand|UNAVAILABLE|Service Unavailable/.test(msg))) return "busy";
  if (status === 400 || status === 404 || /INVALID_ARGUMENT|not found/i.test(msg)) return "bad_request";
  if (e?.name === "ZodError" || /StructuredOutput|parse|JSON/i.test(msg)) return "bad_output";
  if (/fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|network/i.test(msg) || (status >= 500 && status < 600)) return "network";
  return "unknown";
}

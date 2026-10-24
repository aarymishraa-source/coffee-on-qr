import "server-only";
import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { env, llmProvider } from "@/lib/env";

// Model provider: whichever key exists (Anthropic → OpenAI → Google).
// Defaults are overridable with ANTHROPIC_MODEL / OPENAI_MODEL / GOOGLE_MODEL.
export const DEFAULT_MODELS = {
  anthropic: "claude-sonnet-5-5",
  openai: "gpt-4.1-mini",
  google: "gemini-2.5-flash",
} as const;

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
        model: new ChatGoogleGenerativeAI({ apiKey: e.GOOGLE_API_KEY, model: e.GOOGLE_MODEL ?? DEFAULT_MODELS.google }),
        provider: "google",
      };
    }
    default:
      return null;
  }
}

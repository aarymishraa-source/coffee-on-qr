import "server-only";
import { z } from "zod";

// Every variable is optional so the app boots with nothing configured; each
// integration checks for its own keys and reports "Not configured" / "Demo
// fallback" on /console/settings/integrations instead of crashing.
const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  DATABASE_URL: optional,
  AUTH_SECRET: optional,
  NEXT_PUBLIC_APP_URL: optional,

  ANTHROPIC_API_KEY: optional,
  ANTHROPIC_MODEL: optional,
  OPENAI_API_KEY: optional,
  OPENAI_MODEL: optional,
  OPENAI_TRANSCRIBE_MODEL: optional,
  OPENAI_TTS_MODEL: optional,
  GOOGLE_API_KEY: optional,
  GOOGLE_MODEL: optional,
  // Google AI Studio calls it a "Gemini API key"; accept either name.
  GEMINI_API_KEY: optional,
  GEMINI_MODEL: optional,
  SARVAM_API_KEY: optional,

  CLOUDINARY_CLOUD_NAME: optional,
  CLOUDINARY_API_KEY: optional,
  CLOUDINARY_API_SECRET: optional,

  WHATSAPP_TOKEN: optional,
  WHATSAPP_PHONE_NUMBER_ID: optional,
  WHATSAPP_VERIFY_TOKEN: optional,
  WHATSAPP_APP_SECRET: optional,
  WHATSAPP_API_VERSION: optional,

  CASHFREE_CLIENT_ID: optional,
  CASHFREE_CLIENT_SECRET: optional,
  CASHFREE_ENV: z.enum(["sandbox", "production"]).optional().default("sandbox"),
  CASHFREE_API_VERSION: optional,
  CASHFREE_PAYOUT_CLIENT_ID: optional,
  CASHFREE_PAYOUT_CLIENT_SECRET: optional,

  VERCEL: optional,
  VERCEL_URL: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function env(): Env {
  // Only production caches: `next dev` reloads process.env when .env.local
  // changes, and a stale cache would keep reporting "no key" until restart.
  if (!cached || process.env.NODE_ENV !== "production") {
    const e = schema.parse(process.env);
    cached = { ...e, GOOGLE_API_KEY: e.GOOGLE_API_KEY ?? e.GEMINI_API_KEY, GOOGLE_MODEL: e.GOOGLE_MODEL ?? e.GEMINI_MODEL };
  }
  return cached;
}

/** Which LLM provider the assistant and vision use, in order of preference. */
export function llmProvider(): "anthropic" | "openai" | "google" | null {
  const e = env();
  if (e.ANTHROPIC_API_KEY) return "anthropic";
  if (e.OPENAI_API_KEY) return "openai";
  if (e.GOOGLE_API_KEY) return "google";
  return null;
}

export function appUrl(): string {
  const e = env();
  if (e.NEXT_PUBLIC_APP_URL) return e.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
  if (e.VERCEL_URL) return `https://${e.VERCEL_URL}`;
  return "http://localhost:3000";
}

export const isConfigured = {
  cloudinary: () => {
    const e = env();
    return Boolean(e.CLOUDINARY_CLOUD_NAME && e.CLOUDINARY_API_KEY && e.CLOUDINARY_API_SECRET);
  },
  whatsapp: () => {
    const e = env();
    return Boolean(e.WHATSAPP_TOKEN && e.WHATSAPP_PHONE_NUMBER_ID);
  },
  whatsappWebhook: () => {
    const e = env();
    return Boolean(e.WHATSAPP_VERIFY_TOKEN && e.WHATSAPP_APP_SECRET);
  },
  cashfree: () => {
    const e = env();
    return Boolean(e.CASHFREE_CLIENT_ID && e.CASHFREE_CLIENT_SECRET);
  },
  cashfreePayouts: () => {
    const e = env();
    return Boolean(e.CASHFREE_PAYOUT_CLIENT_ID && e.CASHFREE_PAYOUT_CLIENT_SECRET);
  },
  speech: () => {
    const e = env();
    return Boolean(e.SARVAM_API_KEY || e.OPENAI_API_KEY);
  },
  database: () => Boolean(env().DATABASE_URL),
  authSecret: () => Boolean(env().AUTH_SECRET),
};

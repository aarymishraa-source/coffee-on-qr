import "server-only";
import { env, isConfigured, llmProvider } from "@/lib/env";
import { dbMode } from "@/lib/db";
import { DEFAULT_MODELS } from "@/server/integrations/langchain/model";

export type IntegrationState = "connected" | "demo" | "not_configured";

export interface IntegrationRow {
  id: string;
  name: string;
  state: IntegrationState;
  detail: string;
  vars: string[];
  doc?: string;
}

/** Status only — never returns secret values. "Connected" means keys are present; live calls are verified on use. */
export function integrationStatus(): IntegrationRow[] {
  const e = env();
  const llm = llmProvider();
  return [
    {
      id: "database",
      name: "Database",
      state: isConfigured.database() ? "connected" : "demo",
      detail: dbMode() === "postgres" ? "PostgreSQL via DATABASE_URL" : "Embedded PGlite (demo only — on serverless hosts data resets and isn't shared between instances)",
      vars: ["DATABASE_URL"],
      doc: "docs/environment-setup.md",
    },
    {
      id: "auth",
      name: "Sessions",
      state: isConfigured.authSecret() ? "connected" : "demo",
      detail: isConfigured.authSecret() ? "Signed with AUTH_SECRET" : "Using a fixed development secret — set AUTH_SECRET before real use",
      vars: ["AUTH_SECRET"],
    },
    {
      id: "llm",
      name: "AI assistant and vision",
      state: llm ? "connected" : "demo",
      detail: llm
        ? `${llm} · ${llm === "anthropic" ? (e.ANTHROPIC_MODEL ?? DEFAULT_MODELS.anthropic) : llm === "openai" ? (e.OPENAI_MODEL ?? DEFAULT_MODELS.openai) : (e.GOOGLE_MODEL ?? DEFAULT_MODELS.google)} via LangChain`
        : "Rule-based demo assistant; photo checks and grades are labelled demo examples",
      vars: ["ANTHROPIC_API_KEY", "OPENAI_API_KEY", "GOOGLE_API_KEY"],
      doc: "docs/environment-setup.md",
    },
    {
      id: "speech",
      name: "Speech (voice notes)",
      state: isConfigured.speech() ? "connected" : "demo",
      detail: e.SARVAM_API_KEY ? "Sarvam AI (Hindi, Marathi, English)" : e.OPENAI_API_KEY ? "OpenAI transcription and speech" : "Browser Web Speech API where supported; otherwise farmers are asked to type",
      vars: ["SARVAM_API_KEY", "OPENAI_API_KEY"],
    },
    {
      id: "cloudinary",
      name: "Image storage",
      state: isConfigured.cloudinary() ? "connected" : "demo",
      detail: isConfigured.cloudinary() ? "Cloudinary (signed, authenticated uploads)" : "Stored in the database",
      vars: ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"],
    },
    {
      id: "whatsapp",
      name: "WhatsApp Business",
      state: isConfigured.whatsapp() && isConfigured.whatsappWebhook() ? "connected" : isConfigured.whatsapp() || isConfigured.whatsappWebhook() ? "not_configured" : "demo",
      detail:
        isConfigured.whatsapp() && isConfigured.whatsappWebhook()
          ? `Cloud API ${e.WHATSAPP_API_VERSION ?? "v23.0"} · webhook /api/webhooks/whatsapp`
          : isConfigured.whatsapp() || isConfigured.whatsappWebhook()
            ? "Partly configured — sending needs WHATSAPP_TOKEN + WHATSAPP_PHONE_NUMBER_ID, the webhook needs WHATSAPP_VERIFY_TOKEN + WHATSAPP_APP_SECRET"
            : "Messages stay in the portal (\"Demo conversation\")",
      vars: ["WHATSAPP_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_VERIFY_TOKEN", "WHATSAPP_APP_SECRET"],
      doc: "docs/whatsapp-setup.md",
    },
    {
      id: "cashfree",
      name: "Cashfree payments",
      state: isConfigured.cashfree() ? "connected" : "demo",
      detail: isConfigured.cashfree() ? `Payment gateway, ${e.CASHFREE_ENV} mode` : "Simulated payments — clearly labelled, no money moves",
      vars: ["CASHFREE_CLIENT_ID", "CASHFREE_CLIENT_SECRET", "CASHFREE_ENV"],
      doc: "docs/cashfree-setup.md",
    },
    {
      id: "payouts",
      name: "Farmer payouts",
      state: "not_configured",
      detail: isConfigured.cashfreePayouts()
        ? "Payout keys found, but real disbursement isn't implemented in this MVP — payouts stay recorded only"
        : "Not implemented — payouts are recorded as simulated",
      vars: ["CASHFREE_PAYOUT_CLIENT_ID", "CASHFREE_PAYOUT_CLIENT_SECRET"],
      doc: "docs/cashfree-setup.md",
    },
  ];
}

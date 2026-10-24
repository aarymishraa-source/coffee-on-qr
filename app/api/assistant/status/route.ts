import { ok, route } from "@/lib/api";
import { isConfigured, llmProvider } from "@/lib/env";
import { requireActor } from "@/server/auth/session";
import { getSpeechProvider } from "@/server/integrations/speech/providers";

// Tells the chat UI what to label: model or demo replies, server or browser
// speech, WhatsApp delivery or portal-only.
export const GET = route(async () => {
  await requireActor();
  return ok({
    llm: llmProvider(),
    speech: getSpeechProvider()?.name ?? null,
    whatsapp: isConfigured.whatsapp(),
  });
});

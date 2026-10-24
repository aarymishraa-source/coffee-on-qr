import "server-only";
import { isConfigured } from "@/lib/env";
import { graphSendText } from "@/server/integrations/whatsapp/client";

/** Sends a text over WhatsApp. Throws if WhatsApp isn't configured — callers check first. */
export async function sendWhatsAppText(toPhone: string, body: string) {
  if (!isConfigured.whatsapp()) throw new Error("WhatsApp is not configured");
  return graphSendText(toPhone, body);
}

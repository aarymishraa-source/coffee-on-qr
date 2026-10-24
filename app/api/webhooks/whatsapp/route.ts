import { after } from "next/server";
import { getDb } from "@/lib/db";
import { route } from "@/lib/api";
import { createWhatsAppPostHandler, verifyWebhookSubscription } from "@/server/services/whatsapp.service";

// WhatsApp Business Cloud API webhook. See docs/whatsapp-setup.md.
export const GET = route(async (req: Request) => verifyWebhookSubscription(new URL(req.url)));

export const POST = route(createWhatsAppPostHandler((task) => after(task), getDb));

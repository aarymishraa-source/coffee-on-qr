import "server-only";
import type { Db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { Actor } from "@/server/auth/types";
import { assertFarmerAccess } from "@/server/auth/access";
import { getSpeechProvider } from "@/server/integrations/speech/providers";
import { handleFarmerMessage } from "./assistant.service";
import { postMessage } from "./conversation.service";
import { T, type Lang } from "./i18n";
import { saveMedia } from "./media.service";

export interface VoiceInput {
  farmerId: string;
  bytes: Buffer;
  mimeType: string;
  /** Transcript produced in the browser (Web Speech API) when no server provider exists. */
  clientTranscript?: string | null;
  clientKey?: string | null;
  providerMessageId?: string | null;
  channel?: "PORTAL" | "WHATSAPP";
  source?: "VOICE" | "WHATSAPP";
}

export type TranscriptSource = "server" | "browser" | "none";

/**
 * Voice note → stored audio → speech-to-text → assistant reply.
 * Never invents a transcript: without a provider or a browser transcript the
 * farmer is asked to type instead.
 */
export async function handleVoiceNote(db: Db, actor: Actor, input: VoiceInput) {
  await assertFarmerAccess(db, actor, input.farmerId);
  if (input.clientKey) {
    const dup = await db.message.findUnique({ where: { clientKey: input.clientKey } });
    if (dup) return { duplicate: true as const, transcript: dup.body, transcriptSource: "none" as TranscriptSource, reply: null };
  }
  const farmer = await db.farmer.findUniqueOrThrow({ where: { id: input.farmerId } });
  const lang = farmer.language as Lang;
  const media = await saveMedia(db, { kind: "audio", mimeType: input.mimeType, bytes: input.bytes, isDemo: farmer.isDemo });

  let transcript: string | null = null;
  let source: TranscriptSource = "none";
  let provider: string | null = null;
  const speech = getSpeechProvider();
  if (speech) {
    try {
      transcript = (await speech.transcribe(input.bytes, media.mimeType, lang)).trim() || null;
      source = transcript ? "server" : "none";
      provider = speech.name;
    } catch (err) {
      logger.warn("voice: transcription failed", { provider: speech.name, error: err instanceof Error ? err.message : String(err) });
    }
  }
  if (!transcript && input.clientTranscript?.trim()) {
    transcript = input.clientTranscript.trim();
    source = "browser";
  }

  if (transcript) {
    const r = await handleFarmerMessage(db, actor, {
      farmerId: farmer.id,
      text: transcript,
      source: input.source ?? "VOICE",
      type: "AUDIO",
      mediaId: media.id,
      clientKey: input.clientKey,
      providerMessageId: input.providerMessageId,
      channel: input.channel,
      payload: { transcriptSource: source, speechProvider: provider },
    });
    return { duplicate: false as const, transcript, transcriptSource: source, reply: r.reply };
  }

  await postMessage(db, {
    farmerId: farmer.id,
    direction: "IN",
    author: "FARMER",
    type: "AUDIO",
    body: "Voice note",
    mediaId: media.id,
    clientKey: input.clientKey,
    providerMessageId: input.providerMessageId,
    channel: input.channel,
    sentByUserId: actor.role === "FARMER" || !actor.id ? null : actor.id,
    payload: { transcriptSource: "none" },
  });
  const reply = await postMessage(db, {
    farmerId: farmer.id,
    direction: "OUT",
    author: "ASSISTANT",
    body: T.voiceNoTranscript(lang),
    isDemoReply: true,
  });
  return { duplicate: false as const, transcript: null, transcriptSource: source, reply };
}

/** Text-to-speech for a stored assistant message. Returns null when no provider is configured. */
export async function synthesizeMessage(db: Db, actor: Actor, messageId: string) {
  const msg = await db.message.findUnique({ where: { id: messageId }, include: { conversation: { include: { farmer: true } } } });
  if (!msg) return null;
  await assertFarmerAccess(db, actor, msg.conversation.farmerId);
  const speech = getSpeechProvider();
  if (!speech) return null;
  return speech.synthesize(msg.body, msg.conversation.farmer.language as Lang);
}

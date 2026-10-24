import "server-only";
import { env } from "@/lib/env";
import type { Lang } from "@/server/services/i18n";

// Speech providers behind one interface. Sarvam AI is preferred for Hindi and
// Marathi; OpenAI is the general fallback. With neither configured the client
// falls back to the browser's Web Speech API where it supports the language.
export interface SpeechProvider {
  name: string;
  transcribe(audio: Buffer, mimeType: string, lang: Lang): Promise<string>;
  synthesize(text: string, lang: Lang): Promise<{ bytes: Buffer; mimeType: string }>;
}

const BCP47: Record<Lang, string> = { en: "en-IN", hi: "hi-IN", mr: "mr-IN" };

function fileName(mimeType: string) {
  const ext = mimeType.includes("ogg") ? "ogg" : mimeType.includes("mpeg") ? "mp3" : mimeType.includes("mp4") ? "m4a" : mimeType.includes("wav") ? "wav" : "webm";
  return `voice.${ext}`;
}

export class SarvamSpeech implements SpeechProvider {
  name = "sarvam";
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  async transcribe(audio: Buffer, mimeType: string, lang: Lang) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), fileName(mimeType));
    form.append("language_code", BCP47[lang]);
    const res = await this.fetchImpl("https://api.sarvam.ai/speech-to-text", {
      method: "POST",
      headers: { "api-subscription-key": this.apiKey },
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { transcript?: string };
    if (!res.ok || typeof json.transcript !== "string") throw new Error(`Sarvam STT failed (${res.status})`);
    return json.transcript;
  }

  async synthesize(text: string, lang: Lang) {
    const res = await this.fetchImpl("https://api.sarvam.ai/text-to-speech", {
      method: "POST",
      headers: { "api-subscription-key": this.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.slice(0, 1500), target_language_code: BCP47[lang] }),
    });
    const json = (await res.json().catch(() => ({}))) as { audios?: string[] };
    if (!res.ok || !json.audios?.[0]) throw new Error(`Sarvam TTS failed (${res.status})`);
    return { bytes: Buffer.from(json.audios[0], "base64"), mimeType: "audio/wav" };
  }
}

export class OpenAISpeech implements SpeechProvider {
  name = "openai";
  constructor(private apiKey: string, private fetchImpl: typeof fetch = fetch) {}

  async transcribe(audio: Buffer, mimeType: string, lang: Lang) {
    const form = new FormData();
    form.append("file", new Blob([new Uint8Array(audio)], { type: mimeType }), fileName(mimeType));
    form.append("model", env().OPENAI_TRANSCRIBE_MODEL ?? "gpt-4o-mini-transcribe");
    form.append("language", lang);
    const res = await this.fetchImpl("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}` },
      body: form,
    });
    const json = (await res.json().catch(() => ({}))) as { text?: string };
    if (!res.ok || typeof json.text !== "string") throw new Error(`OpenAI transcription failed (${res.status})`);
    return json.text;
  }

  async synthesize(text: string) {
    const res = await this.fetchImpl("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: { Authorization: `Bearer ${this.apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env().OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts", voice: "alloy", input: text.slice(0, 4000), response_format: "mp3" }),
    });
    if (!res.ok) throw new Error(`OpenAI TTS failed (${res.status})`);
    return { bytes: Buffer.from(await res.arrayBuffer()), mimeType: "audio/mpeg" };
  }
}

let override: SpeechProvider | null | undefined;
export function __setSpeechForTests(p: SpeechProvider | null | undefined) {
  override = p;
}

export function getSpeechProvider(): SpeechProvider | null {
  if (override !== undefined) return override;
  const e = env();
  if (e.SARVAM_API_KEY) return new SarvamSpeech(e.SARVAM_API_KEY);
  if (e.OPENAI_API_KEY) return new OpenAISpeech(e.OPENAI_API_KEY);
  return null;
}

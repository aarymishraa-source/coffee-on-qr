"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertCircle, Check, CheckCheck, Clock3, RotateCcw, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { timeOnly } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { LANG_BCP47, type ChatMessage, type ConversationDetail, type CropResult, type Lang } from "../types";
import { CropResultCard, OfferCard } from "./MessageCards";

export interface PendingMessage {
  tempId: string;
  kind: "text" | "image" | "audio";
  body: string;
  previewUrl?: string;
  status: "sending" | "failed";
  error?: string;
  retry: () => void;
}

// Low-contrast leaf wallpaper (decorative).
const WALLPAPER =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%232E4A2C' stroke-opacity='0.06' stroke-width='1.5'%3E%3Cpath d='M20 40c0-12 9-20 21-21-1 12-9 21-21 21Z'/%3E%3Cpath d='M20 40 33 27'/%3E%3Cpath d='M80 95c0-10 8-17 18-18-1 10-8 18-18 18Z'/%3E%3Cpath d='M80 95l11-11'/%3E%3Ccircle cx='95' cy='25' r='3'/%3E%3Ccircle cx='35' cy='92' r='2'/%3E%3C/g%3E%3C/svg%3E\")";

// Why a reply fell back to the demo assistant (see classifyModelError).
const MODEL_ERROR_LABEL: Record<string, string> = {
  auth: "API key rejected",
  quota: "quota or rate limit",
  bad_request: "request rejected",
  timeout: "timed out",
  network: "provider unreachable",
  bad_output: "unreadable answer",
  unknown: "error",
};

function dayLabel(iso: string) {
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (key(d) === key(today)) return "Today";
  if (key(d) === key(yesterday)) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", timeZone: "Asia/Kolkata" });
}

interface Props {
  detail: ConversationDetail;
  pending: PendingMessage[];
  typing: boolean;
  showTranslations: boolean;
  canAnswerOffers: boolean;
  onFollowUp: () => void;
}

export function MessageList({ detail, pending, typing, showTranslations, canAnswerOffers, onFollowUp }: Props) {
  const end = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const count = detail.messages.length + pending.length + (typing ? 1 : 0);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "end" });
  }, [count, reduce]);

  // Farmer messages count as read once the assistant has answered after them.
  const lastOutAt = [...detail.messages].reverse().find((m) => m.direction === "OUT")?.createdAt ?? "";

  return (
    <div className="flex-1 overflow-y-auto bg-chat-wallpaper px-3 py-4 md:px-[6%]" style={{ backgroundImage: WALLPAPER }} aria-live="polite">
      <div className="mx-auto flex max-w-3xl flex-col gap-1.5">
        {detail.messages.map((m, i) => {
          const day = dayLabel(m.createdAt);
          const prev = detail.messages[i - 1];
          const showDay = !prev || dayLabel(prev.createdAt) !== day;
          const firstInGroup = !prev || prev.direction !== m.direction || showDay;
          return (
            <div key={m.id}>
              {showDay && (
                <div className="my-3 flex justify-center">
                  <span className="rounded-lg bg-surface/90 px-3 py-1 text-xs text-muted-foreground shadow-xs">{day}</span>
                </div>
              )}
              <Bubble
                m={m}
                detail={detail}
                firstInGroup={firstInGroup}
                read={m.direction === "IN" && m.createdAt <= lastOutAt}
                showTranslation={showTranslations}
                canAnswerOffers={canAnswerOffers}
                onFollowUp={onFollowUp}
                animate={!reduce && i >= detail.messages.length - 2}
              />
            </div>
          );
        })}
        {pending.map((p) => (
          <PendingBubble key={p.tempId} p={p} />
        ))}
        <AnimatePresence>{typing && <TypingBubble key="typing" />}</AnimatePresence>
        <div ref={end} />
      </div>
    </div>
  );
}

function Bubble({
  m, detail, firstInGroup, read, showTranslation, canAnswerOffers, onFollowUp, animate,
}: {
  m: ChatMessage;
  detail: ConversationDetail;
  firstInGroup: boolean;
  read: boolean;
  showTranslation: boolean;
  canAnswerOffers: boolean;
  onFollowUp: () => void;
  animate: boolean;
}) {
  const mine = m.direction === "IN"; // the farmer's own messages sit on the right
  const lang = detail.farmer.language;
  const card = m.type === "OFFER" || m.type === "CROP_ANALYSIS";
  return (
    <motion.div
      initial={animate ? { opacity: 0, y: 6 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className={cn("flex", mine ? "justify-end" : "justify-start", firstInGroup && "mt-2")}
    >
      <div
        className={cn(
          "relative max-w-[85%] rounded-lg px-2.5 pb-1.5 pt-1.5 text-sm shadow-xs md:max-w-[65%]",
          mine ? "bg-primary-soft" : "bg-surface",
          firstInGroup && (mine ? "rounded-tr-none" : "rounded-tl-none")
        )}
      >
        {firstInGroup && <Tail mine={mine} />}
        {!mine && firstInGroup && (
          <p className="mb-0.5 text-xs font-medium text-primary">{m.author === "SYSTEM" ? "Coffee on QR" : "Kisan Sahayak"}</p>
        )}
        {m.type === "IMAGE" && m.mediaUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.mediaUrl} alt="Crop photo sent by the farmer" className="mb-1 max-h-72 w-64 max-w-full rounded-md object-cover" />
        )}
        {m.type === "AUDIO" && m.mediaUrl && <audio controls src={m.mediaUrl} className="mb-1 h-10 w-64 max-w-full" />}
        {m.type === "OFFER" ? (
          <OfferCard
            offer={detail.offers.find((o) => o.id === m.payload.offerId)}
            farmerId={detail.farmer.id}
            lang={lang}
            canAnswer={canAnswerOffers}
          />
        ) : m.type === "CROP_ANALYSIS" && m.payload.result ? (
          <CropResultCard
            result={m.payload.result as CropResult}
            isDemo={Boolean(m.payload.isDemo)}
            analysisId={String(m.payload.analysisId)}
            expertRequestedAt={m.expertRequestedAt}
            farmerId={detail.farmer.id}
            onFollowUp={onFollowUp}
          />
        ) : (
          (m.type !== "IMAGE" || m.body !== "Photo") && (
            <p lang={mine || m.author === "ASSISTANT" ? lang : undefined} className="whitespace-pre-wrap break-words pr-1">
              {m.type === "AUDIO" && m.body !== "Voice note" && <span className="text-xs text-muted-foreground">Transcript: </span>}
              {m.body}
            </p>
          )
        )}
        {mine && showTranslation && m.translation && lang !== "en" && (
          <p className="mt-1 border-t border-primary/10 pt-1 text-xs italic text-muted-foreground">{m.translation}</p>
        )}
        <div className={cn("mt-0.5 flex items-center justify-end gap-1.5 text-[11px] leading-none text-muted-foreground", card && "mt-2")}>
          {m.isDemoReply && (
            <span
              className="rounded border border-dashed border-hairline px-1 py-px"
              title={m.payload.fallback === "model_error" ? "The AI model call failed, so the rule-based demo assistant answered. Details are in the server log." : undefined}
            >
              {m.payload.fallback === "model_error" ? `Demo reply · AI unavailable (${MODEL_ERROR_LABEL[String(m.payload.modelError)] ?? "error"})` : "Demo reply"}
            </span>
          )}
          {m.payload.transcriptSource === "browser" && <span>Transcribed in browser</span>}
          {m.agentAssisted && <span>Sent by agent</span>}
          {m.channel === "WHATSAPP" && <span>WhatsApp</span>}
          {!mine && m.type === "TEXT" && <SpeakButton messageId={m.id} text={m.body} lang={lang} />}
          <time dateTime={m.createdAt}>{timeOnly(m.createdAt)}</time>
          {mine && <Ticks read={read} />}
          {!mine && m.channel === "WHATSAPP" && <OutStatus status={m.status} />}
        </div>
      </div>
    </motion.div>
  );
}

function Tail({ mine }: { mine: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 8 13"
      width="8"
      height="13"
      className={cn("absolute top-0", mine ? "-right-2 text-primary-soft" : "-left-2 -scale-x-100 text-surface")}
    >
      <path d="M0 0h8L0 13z" fill="currentColor" />
    </svg>
  );
}

function Ticks({ read }: { read: boolean }) {
  return read ? (
    <CheckCheck className="size-3.5 text-primary" aria-label="Read" />
  ) : (
    <Check className="size-3.5" aria-label="Sent" />
  );
}

function OutStatus({ status }: { status: ChatMessage["status"] }) {
  if (status === "FAILED") return <AlertCircle className="size-3.5 text-danger" aria-label="Not delivered" />;
  if (status === "PENDING") return <Clock3 className="size-3.5" aria-label="Sending" />;
  if (status === "READ") return <CheckCheck className="size-3.5 text-primary" aria-label="Read" />;
  if (status === "DELIVERED") return <CheckCheck className="size-3.5" aria-label="Delivered" />;
  return <Check className="size-3.5" aria-label="Sent" />;
}

function PendingBubble({ p }: { p: PendingMessage }) {
  return (
    <div className="mt-2 flex justify-end">
      <div className="max-w-[85%] rounded-lg rounded-tr-none bg-primary-soft px-2.5 py-1.5 text-sm opacity-90 shadow-xs md:max-w-[65%]">
        {p.kind === "image" && p.previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.previewUrl} alt="Photo being sent" className="mb-1 max-h-72 w-64 max-w-full rounded-md object-cover" />
        )}
        {p.kind === "audio" && p.previewUrl && <audio controls src={p.previewUrl} className="mb-1 h-10 w-64 max-w-full" />}
        {p.body && <p className="whitespace-pre-wrap break-words">{p.body}</p>}
        <div className="mt-0.5 flex items-center justify-end gap-1.5 text-[11px] text-muted-foreground">
          {p.status === "sending" ? (
            <>
              <span>{p.kind === "image" ? "Uploading and checking photo…" : p.kind === "audio" ? "Uploading voice note…" : "Sending…"}</span>
              <Clock3 className="size-3.5" aria-label="Sending" />
            </>
          ) : (
            <button type="button" onClick={p.retry} className="inline-flex items-center gap-1 text-danger hover:underline">
              <AlertCircle className="size-3.5" aria-hidden="true" />
              {p.error ?? "Not sent"} · Retry
              <RotateCcw className="size-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="mt-2 flex">
      <div className="flex items-center gap-1 rounded-lg rounded-tl-none bg-surface px-3 py-3 shadow-xs" role="status" aria-label="Kisan Sahayak is typing">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="size-1.5 rounded-full bg-muted-foreground"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </div>
    </motion.div>
  );
}

/** Plays server TTS when configured; otherwise the browser's voice for the language, if it has one. */
function SpeakButton({ messageId, text, lang }: { messageId: string; text: string; lang: Lang }) {
  const [busy, setBusy] = useState(false);
  async function speak() {
    setBusy(true);
    try {
      const res = await fetch("/api/voice/tts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId }) });
      if (res.ok && res.headers.get("content-type")?.startsWith("audio/")) {
        const url = URL.createObjectURL(await res.blob());
        const audio = new Audio(url);
        audio.onended = () => URL.revokeObjectURL(url);
        await audio.play();
        return;
      }
      const synth = typeof window !== "undefined" ? window.speechSynthesis : undefined;
      const voice = synth?.getVoices().find((v) => v.lang.toLowerCase().startsWith(lang));
      if (!synth || (!voice && lang !== "en")) {
        toast.message(`No ${lang === "mr" ? "Marathi" : lang === "hi" ? "Hindi" : "English"} voice is available in this browser`, {
          description: "Configure a speech provider (Sarvam or OpenAI) for spoken replies.",
        });
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = LANG_BCP47[lang];
      if (voice) u.voice = voice;
      synth.cancel();
      synth.speak(u);
    } catch {
      toast.error("Couldn't play this reply. Try again.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" onClick={speak} disabled={busy} className="rounded p-0.5 hover:text-foreground disabled:opacity-50" aria-label="Listen to this reply">
      <Volume2 className="size-3.5" aria-hidden="true" />
    </button>
  );
}

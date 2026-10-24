"use client";

import { useEffect, useRef, useState } from "react";
import { ImageIcon, Leaf, Mic, Paperclip, Send, Square, Trash2, X, FileAudio, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/shadcn/dropdown-menu";
import { Button } from "@/components/shadcn/button";
import { cn } from "@/lib/utils";
import { useRecorder } from "../hooks/useRecorder";
import { LANG_BCP47, type Lang } from "../types";

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_IMAGE = 8 * 1024 * 1024;

export interface ComposerHandle {
  focusWith: (text: string) => void;
}

interface Props {
  lang: Lang;
  placeholder: string;
  speechConfigured: boolean;
  disabled?: boolean;
  onSendText: (text: string) => void;
  onSendImage: (file: File, note: string) => void;
  onSendAudio: (blob: Blob, transcript: string) => void;
  registerFocus?: (fn: (text: string) => void) => void;
}

export function Composer({ lang, placeholder, speechConfigured, disabled, onSendText, onSendImage, onSendAudio, registerFocus }: Props) {
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ file: File; url: string } | null>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const imagePicker = useRef<HTMLInputElement>(null);
  const audioPicker = useRef<HTMLInputElement>(null);
  const rec = useRecorder(LANG_BCP47[lang]);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    registerFocus?.((t) => {
      setText(t);
      requestAnimationFrame(() => input.current?.focus());
    });
  }, [registerFocus]);

  useEffect(() => {
    if (rec.state.kind !== "recording") return;
    const started = rec.state.startedAt;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 250);
    return () => clearInterval(id);
  }, [rec.state]);

  useEffect(() => {
    if (rec.state.kind === "error") toast.error(rec.state.message);
  }, [rec.state]);

  // Auto-grow the text box up to five lines.
  useEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  function pickImage(file: File | undefined) {
    if (!file) return;
    if (!IMAGE_TYPES.includes(file.type)) return toast.error("Send a JPEG, PNG or WebP photo.");
    if (file.size > MAX_IMAGE) return toast.error("Photos must be 8 MB or smaller.");
    setImage({ file, url: URL.createObjectURL(file) });
  }

  async function useSample() {
    try {
      const res = await fetch("/demo/basil-leaf.jpg");
      const blob = await res.blob();
      pickImage(new File([blob], "basil-leaf.jpg", { type: "image/jpeg" }));
    } catch {
      toast.error("Couldn't load the sample photo.");
    }
  }

  function send() {
    if (disabled) return;
    if (image) {
      onSendImage(image.file, text.trim());
      setImage(null);
      setText("");
      return;
    }
    const t = text.trim();
    if (!t) return;
    onSendText(t);
    setText("");
  }

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const s = rec.state;

  if (s.kind === "recording") {
    return (
      <div className="flex min-h-[62px] items-center gap-3 border-t border-hairline bg-sunken px-3 py-2">
        <Button variant="ghost" size="icon" onClick={rec.cancel} aria-label="Cancel recording">
          <Trash2 aria-hidden="true" />
        </Button>
        <span className="flex items-center gap-2 text-sm tabular">
          <span className="size-2.5 animate-pulse rounded-full bg-danger" aria-hidden="true" />
          {fmt(elapsed)}
        </span>
        <div className="flex h-8 flex-1 items-center gap-[3px]" aria-hidden="true">
          {rec.levels.map((l, i) => (
            <span key={i} className="w-[3px] rounded-full bg-primary transition-[height] duration-75" style={{ height: `${Math.round(l * 100)}%` }} />
          ))}
        </div>
        <span className="sr-only" role="status">Recording voice note</span>
        <Button size="icon" className="rounded-full" onClick={rec.stop} aria-label="Stop recording">
          <Square className="fill-current" aria-hidden="true" />
        </Button>
      </div>
    );
  }

  if (s.kind === "preview") {
    return (
      <div className="space-y-2 border-t border-hairline bg-sunken px-3 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={rec.reset} aria-label="Discard voice note">
            <Trash2 aria-hidden="true" />
          </Button>
          <audio controls src={s.url} className="h-10 min-w-0 flex-1" />
          <Button variant="ghost" size="icon" onClick={() => (rec.reset(), rec.start())} aria-label="Record again">
            <RotateCcw aria-hidden="true" />
          </Button>
          <Button
            size="icon"
            className="rounded-full"
            aria-label="Send voice note"
            disabled={disabled}
            onClick={() => {
              onSendAudio(s.blob, s.transcript);
              rec.reset();
            }}
          >
            <Send aria-hidden="true" />
          </Button>
        </div>
        {!speechConfigured && (
          <label className="block text-xs text-muted-foreground">
            {rec.browserTranscription ? "Transcript from your browser — check it before sending:" : "Speech-to-text isn't set up. The assistant will ask you to type instead."}
            {rec.browserTranscription && (
              <input
                value={s.transcript}
                onChange={(e) => rec.setTranscript(e.target.value)}
                placeholder="No speech recognised"
                className="mt-1 h-8 w-full rounded-md border border-hairline bg-surface px-2 text-sm text-foreground"
              />
            )}
          </label>
        )}
      </div>
    );
  }

  const hasContent = !!text.trim() || !!image;
  return (
    <div className="border-t border-hairline bg-sunken">
      {image && (
        <div className="flex items-start gap-3 px-3 pt-3">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.url} alt="Selected photo" className="size-24 rounded-lg object-cover" />
            <button
              type="button"
              onClick={() => setImage(null)}
              className="absolute -right-2 -top-2 rounded-full bg-foreground p-1 text-background"
              aria-label="Remove photo"
            >
              <X className="size-3" aria-hidden="true" />
            </button>
          </div>
          <p className="pt-1 text-xs text-muted-foreground">Add a note (optional), then send. The photo is checked for visible symptoms — not a diagnosis.</p>
        </div>
      )}
      <div className="flex min-h-[62px] items-end gap-1.5 px-2 py-2.5">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Attach" disabled={disabled}>
              <Paperclip aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start">
            <DropdownMenuItem onSelect={() => imagePicker.current?.click()}>
              <ImageIcon aria-hidden="true" /> Crop photo
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => audioPicker.current?.click()}>
              <FileAudio aria-hidden="true" /> Audio file
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={useSample}>
              <Leaf aria-hidden="true" /> Sample leaf photo (demo)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <input ref={imagePicker} type="file" accept={IMAGE_TYPES.join(",")} hidden onChange={(e) => (pickImage(e.target.files?.[0]), (e.target.value = ""))} />
        <input
          ref={audioPicker}
          type="file"
          accept="audio/*"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (f) onSendAudio(f, "");
          }}
        />
        <label className="sr-only" htmlFor="composer">
          Message
        </label>
        <textarea
          id="composer"
          ref={input}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={image ? "Add a note" : placeholder}
          lang={lang}
          className="max-h-[120px] min-h-10 flex-1 resize-none rounded-lg border border-hairline bg-surface px-3 py-2.5 text-sm leading-5 outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/30"
        />
        {hasContent ? (
          <Button size="icon" className="size-10 rounded-full" onClick={send} aria-label="Send" disabled={disabled}>
            <Send aria-hidden="true" />
          </Button>
        ) : (
          <Button
            size="icon"
            className={cn("size-10 rounded-full")}
            onClick={rec.start}
            aria-label="Record voice note"
            disabled={disabled}
          >
            <Mic aria-hidden="true" />
          </Button>
        )}
      </div>
    </div>
  );
}

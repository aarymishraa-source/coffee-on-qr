"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};

function getRecognition(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type RecorderState =
  | { kind: "idle" }
  | { kind: "recording"; startedAt: number }
  | { kind: "preview"; blob: Blob; url: string; seconds: number; transcript: string }
  | { kind: "error"; message: string };

/**
 * MediaRecorder voice notes with a live level meter (AnalyserNode) and, where
 * the browser supports it, an in-browser transcript (Web Speech API) used only
 * when no server speech provider is configured.
 */
export function useRecorder(lang: string) {
  const [state, setState] = useState<RecorderState>({ kind: "idle" });
  const [levels, setLevels] = useState<number[]>(() => Array(28).fill(0.08));
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const raf = useRef<number | null>(null);
  const audioCtx = useRef<AudioContext | null>(null);
  const recognition = useRef<SpeechRecognitionLike | null>(null);
  const transcript = useRef("");
  const cancelled = useRef(false);

  const cleanup = useCallback(() => {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = null;
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    audioCtx.current?.close().catch(() => {});
    audioCtx.current = null;
    try {
      recognition.current?.stop();
    } catch {}
    recognition.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const supported = typeof window !== "undefined" && typeof window.MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
  const browserTranscription = !!getRecognition();

  const start = useCallback(async () => {
    if (!supported) {
      setState({ kind: "error", message: "This browser can't record audio. Attach an audio file instead." });
      return;
    }
    try {
      cancelled.current = false;
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = s;
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg", "audio/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(s, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
      const startedAt = Date.now();
      rec.onstop = () => {
        const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
        cleanup();
        if (cancelled.current) return setState({ kind: "idle" });
        setState({ kind: "preview", blob, url: URL.createObjectURL(blob), seconds: Math.round((Date.now() - startedAt) / 1000), transcript: transcript.current.trim() });
      };
      recRef.current = rec;
      rec.start();

      const ctx = new AudioContext();
      audioCtx.current = ctx;
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      ctx.createMediaStreamSource(s).connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const v of data) peak = Math.max(peak, Math.abs(v - 128) / 128);
        setLevels((prev) => [...prev.slice(1), Math.max(0.08, Math.min(1, peak * 2.2))]);
        raf.current = requestAnimationFrame(tick);
      };
      tick();

      transcript.current = "";
      const Rec = getRecognition();
      if (Rec) {
        try {
          const r = new Rec();
          r.lang = lang;
          r.continuous = true;
          r.interimResults = false;
          r.onresult = (e) => {
            transcript.current = Array.from(e.results).map((x) => x[0].transcript).join(" ");
          };
          r.onerror = () => {};
          r.start();
          recognition.current = r;
        } catch {}
      }
      setState({ kind: "recording", startedAt });
    } catch {
      cleanup();
      setState({ kind: "error", message: "Microphone access was blocked. Allow it in the browser, or attach an audio file." });
    }
  }, [cleanup, lang, supported]);

  const stop = useCallback(() => recRef.current?.state === "recording" && recRef.current.stop(), []);

  const cancel = useCallback(() => {
    cancelled.current = true;
    if (recRef.current?.state === "recording") recRef.current.stop();
    else {
      cleanup();
      setState({ kind: "idle" });
    }
  }, [cleanup]);

  const reset = useCallback(() => {
    setState((s) => {
      if (s.kind === "preview") URL.revokeObjectURL(s.url);
      return { kind: "idle" };
    });
  }, []);

  const setTranscript = useCallback((t: string) => setState((s) => (s.kind === "preview" ? { ...s, transcript: t } : s)), []);

  return { state, levels, start, stop, cancel, reset, setTranscript, supported, browserTranscription };
}

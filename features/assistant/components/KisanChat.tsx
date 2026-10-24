"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Info, Languages, MessagesSquare } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/shadcn/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/shadcn/tooltip";
import { ErrorState } from "@/components/feedback/States";
import { apiGet, apiSend, newKey } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { LANG_LABEL, type AssistantStatus, type ConversationDetail, type ConversationSummary, type Lang } from "../types";
import { ConversationList } from "./ConversationList";
import { MessageList, type PendingMessage } from "./MessageList";
import { Composer } from "./Composer";
import { ContextPanel } from "./ContextPanel";
import { AssistantAvatar, Avatar } from "./Avatar";

interface Props {
  role: "ADMIN" | "FPO_MANAGER" | "FIELD_AGENT" | "FARMER";
  userName: string;
}

export function KisanChat({ role, userName }: Props) {
  const router = useRouter();
  const params = useSearchParams();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string | null>(params.get("farmer"));
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [typing, setTyping] = useState(0);
  const [showTranslations, setShowTranslations] = useState(true);
  const [panelOpen, setPanelOpen] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const focusRef = useRef<(t: string) => void>(() => {});

  const status = useQuery({ queryKey: ["assistant-status"], queryFn: () => apiGet<AssistantStatus>("/api/assistant/status"), staleTime: 60_000 });
  const list = useQuery({ queryKey: ["conversations"], queryFn: () => apiGet<ConversationSummary[]>("/api/assistant/conversations"), refetchInterval: 5000 });
  const detail = useQuery({
    queryKey: ["conversation", selected],
    queryFn: () => apiGet<ConversationDetail>(`/api/assistant/conversations/${selected}`),
    enabled: !!selected,
    refetchInterval: 3000,
  });

  // Farmers have exactly one conversation — open it directly.
  useEffect(() => {
    if (!selected && role === "FARMER" && list.data?.[0]) setSelected(list.data[0].farmerId);
  }, [list.data, role, selected]);

  useEffect(() => {
    const reset = () => qc.invalidateQueries();
    window.addEventListener("cqr:demo-reset", reset);
    return () => window.removeEventListener("cqr:demo-reset", reset);
  }, [qc]);

  const unread = list.data?.find((c) => c.farmerId === selected)?.unread ?? 0;
  useEffect(() => {
    if (!selected || !unread) return;
    apiSend(`/api/assistant/conversations/${selected}/read`).then(() => qc.invalidateQueries({ queryKey: ["conversations"] }), () => {});
  }, [selected, unread, qc]);

  const open = useCallback(
    (id: string) => {
      setSelected(id);
      setPending([]);
      router.replace(`/kisan?farmer=${id}`, { scroll: false });
    },
    [router]
  );

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ["conversation", selected] });
    qc.invalidateQueries({ queryKey: ["conversations"] });
  }, [qc, selected]);

  const run = useCallback(
    (p: Omit<PendingMessage, "tempId" | "status" | "retry">, exec: () => Promise<unknown>) => {
      const tempId = newKey("tmp");
      const attempt = async () => {
        setPending((xs) => xs.map((x) => (x.tempId === tempId ? { ...x, status: "sending", error: undefined } : x)));
        setTyping((n) => n + 1);
        try {
          await exec();
          await refresh();
          setPending((xs) => xs.filter((x) => x.tempId !== tempId));
        } catch (e) {
          setPending((xs) => xs.map((x) => (x.tempId === tempId ? { ...x, status: "failed", error: (e as Error).message } : x)));
        } finally {
          setTyping((n) => n - 1);
        }
      };
      setPending((xs) => [...xs, { ...p, tempId, status: "sending", retry: attempt }]);
      attempt();
    },
    [refresh]
  );

  const farmerId = selected;
  const sendText = (text: string) => {
    const clientKey = newKey("msg");
    run({ kind: "text", body: text }, () => apiSend("/api/assistant/messages", { farmerId, text, clientKey }));
  };
  const sendImage = (file: File, note: string) => {
    const clientKey = newKey("img");
    run({ kind: "image", body: note, previewUrl: URL.createObjectURL(file) }, () => {
      const fd = new FormData();
      fd.set("farmerId", farmerId!);
      fd.set("file", file);
      fd.set("clientKey", clientKey);
      if (note) fd.set("note", note);
      return apiSend("/api/crop-analysis", fd);
    });
  };
  const sendAudio = (blob: Blob, transcript: string) => {
    const clientKey = newKey("voice");
    run({ kind: "audio", body: transcript, previewUrl: URL.createObjectURL(blob) }, () => {
      const fd = new FormData();
      fd.set("farmerId", farmerId!);
      fd.set("file", new File([blob], "voice-note", { type: blob.type || "audio/webm" }));
      fd.set("clientKey", clientKey);
      if (transcript) fd.set("clientTranscript", transcript);
      return apiSend("/api/voice", fd);
    });
  };

  async function changeLanguage(language: Lang) {
    try {
      await apiSend(`/api/assistant/conversations/${farmerId}/language`, { language });
      toast.success(`Replies will be in ${LANG_LABEL[language]}`);
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const d = detail.data;
  const isFarmer = role === "FARMER";
  const canViewProfile = role !== "FARMER";
  const lastIn = d?.messages.filter((m) => m.direction === "IN").at(-1);
  const placeholder = isFarmer ? "Message Kisan Sahayak" : d ? `Type for ${d.farmer.name.split(" ")[0]} (agent-assisted)` : "Message";

  return (
    <div className="flex h-[calc(100dvh-3.5rem-4.5rem)] overflow-hidden border-hairline bg-surface lg:h-[calc(100dvh-3.5rem)]">
      {!isFarmer && (
        <aside className={cn("w-full shrink-0 border-r border-hairline md:w-[320px] xl:w-[360px]", selected ? "hidden md:block" : "block")}>
          <ConversationList items={list.data} error={list.error as Error | null} onRetry={() => list.refetch()} selectedId={selected} onSelect={open} />
        </aside>
      )}

      <section className={cn("min-w-0 flex-1 flex-col", selected || isFarmer ? "flex" : "hidden md:flex")} aria-label="Conversation">
        {!selected ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-sunken px-6 text-center">
            <MessagesSquare className="size-8 text-muted-foreground" aria-hidden="true" />
            <p className="text-base font-medium">Kisan Sahayak</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Pick a farmer to see their chat with the assistant, answer café orders on their behalf, or send a crop photo.
            </p>
          </div>
        ) : detail.isError ? (
          <ErrorState message={(detail.error as Error).message} onRetry={() => detail.refetch()} />
        ) : !d ? (
          <div className="flex-1 animate-pulse bg-chat-wallpaper" aria-busy="true" />
        ) : (
          <>
            <header className="flex h-[60px] shrink-0 items-center gap-3 border-b border-hairline bg-sunken px-3">
              {!isFarmer && (
                <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSelected(null)} aria-label="Back to chats">
                  <ArrowLeft aria-hidden="true" />
                </Button>
              )}
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => (window.innerWidth >= 1280 ? setPanelOpen((v) => !v) : setSheetOpen(true))}>
                {isFarmer ? <AssistantAvatar size={40} /> : <Avatar name={d.farmer.name} size={40} />}
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-medium">{isFarmer ? "Kisan Sahayak" : d.farmer.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {lastIn ? `Last message ${new Date(lastIn.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}` : "No messages yet"} ·{" "}
                    {d.farmer.village} · {LANG_LABEL[d.farmer.language]}
                  </span>
                </span>
              </button>
              <div className="hidden items-center gap-1.5 sm:flex">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className={cn("rounded-full px-2 py-0.5 text-xs", status.data?.llm ? "bg-primary-soft text-primary" : "border border-dashed border-hairline text-muted-foreground")}>
                      {status.data?.llm ? "AI assistant" : "Demo replies"}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {status.data?.llm ? `Replies by ${status.data.llm} via LangChain, using stored records only` : "No model key configured — replies come from a rule-based demo assistant"}
                  </TooltipContent>
                </Tooltip>
                {status.data && !status.data.whatsapp && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="rounded-full border border-dashed border-hairline px-2 py-0.5 text-xs text-muted-foreground">Demo conversation</span>
                    </TooltipTrigger>
                    <TooltipContent>WhatsApp isn&apos;t connected — messages stay in this portal and are not sent to the farmer&apos;s phone.</TooltipContent>
                  </Tooltip>
                )}
              </div>
              <Select value={d.farmer.language} onValueChange={(v) => changeLanguage(v as Lang)}>
                <SelectTrigger size="sm" className="w-auto gap-1 border-none bg-transparent px-2 shadow-none" aria-label="Reply language">
                  <Languages className="size-4" aria-hidden="true" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="end">
                  {(Object.keys(LANG_LABEL) as Lang[]).map((l) => (
                    <SelectItem key={l} value={l}>
                      {LANG_LABEL[l]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {d.farmer.language !== "en" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden lg:inline-flex"
                  aria-pressed={showTranslations}
                  onClick={() => setShowTranslations((v) => !v)}
                >
                  {showTranslations ? "Hide translations" : "Show translations"}
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => (window.innerWidth >= 1280 ? setPanelOpen((v) => !v) : setSheetOpen(true))} aria-label="Farmer details">
                <Info aria-hidden="true" />
              </Button>
            </header>
            <MessageList
              detail={d}
              pending={pending}
              typing={typing > 0}
              showTranslations={showTranslations}
              canAnswerOffers
              onFollowUp={() => focusRef.current(d.farmer.language === "mr" ? "या फोटोबद्दल: " : d.farmer.language === "hi" ? "इस फ़ोटो के बारे में: " : "About this photo: ")}
            />
            <Composer
              lang={d.farmer.language}
              placeholder={placeholder}
              speechConfigured={!!status.data?.speech}
              onSendText={sendText}
              onSendImage={sendImage}
              onSendAudio={sendAudio}
              registerFocus={(fn) => (focusRef.current = fn)}
            />
          </>
        )}
      </section>

      {d && panelOpen && (
        <aside className="hidden w-[320px] shrink-0 border-l border-hairline xl:block">
          <ContextPanel detail={d} onClose={() => setPanelOpen(false)} canViewProfile={canViewProfile} />
        </aside>
      )}
      <Sheet open={sheetOpen && !!d} onOpenChange={setSheetOpen}>
        <SheetContent side="right" className="w-full p-0 sm:max-w-[360px]">
          <SheetTitle className="sr-only">Farmer details</SheetTitle>
          {d && <ContextPanel detail={d} canViewProfile={canViewProfile} />}
        </SheetContent>
      </Sheet>
      <span className="sr-only">Signed in as {userName}</span>
    </div>
  );
}

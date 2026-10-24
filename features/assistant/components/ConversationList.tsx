"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SkeletonRows, ErrorState, EmptyState } from "@/components/feedback/States";
import type { ConversationSummary } from "../types";
import { Avatar } from "./Avatar";

type Filter = "all" | "unread" | "orders" | "crop";
const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "orders", label: "Orders" },
  { id: "crop", label: "Crop help" },
];

function when(iso: string) {
  const d = new Date(iso);
  const key = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  if (key(d) === key(new Date())) return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  if (key(d) === key(new Date(Date.now() - 86_400_000))) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
}

function preview(c: ConversationSummary) {
  const m = c.lastMessage;
  if (!m) return "No messages yet";
  const who = m.direction === "OUT" ? "Sahayak: " : "";
  if (m.type === "IMAGE") return `${who}Photo`;
  if (m.type === "AUDIO") return `${who}Voice note`;
  if (m.type === "OFFER") return "New café order";
  if (m.type === "CROP_ANALYSIS") return "Photo check result";
  return `${who}${m.body}`;
}

interface Props {
  items: ConversationSummary[] | undefined;
  error: Error | null;
  onRetry: () => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function ConversationList({ items, error, onRetry, selectedId, onSelect }: Props) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (items ?? []).filter((c) => {
      if (needle && !`${c.name} ${c.village} ${c.lastMessage?.body ?? ""}`.toLowerCase().includes(needle)) return false;
      if (filter === "unread") return c.unread > 0;
      if (filter === "orders") return c.tags.order;
      if (filter === "crop") return c.tags.cropHelp;
      return true;
    });
  }, [items, q, filter]);

  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="space-y-3 border-b border-hairline px-3 pb-3 pt-3">
        <h2 className="px-1 text-xl font-semibold">Chats</h2>
        <label className="relative block">
          <span className="sr-only">Search farmers or messages</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search farmers or messages"
            className="h-9 w-full rounded-lg bg-sunken pl-9 pr-3 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-[3px] focus-visible:ring-ring/30"
          />
        </label>
        <div className="flex gap-1.5" role="group" aria-label="Filter chats">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={cn(
                "rounded-full px-3 py-1 text-xs transition-colors duration-150",
                filter === f.id ? "bg-primary-soft font-medium text-primary" : "bg-sunken text-muted-foreground hover:text-foreground"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {error ? (
          <ErrorState message={error.message} onRetry={onRetry} />
        ) : !items ? (
          <SkeletonRows rows={6} />
        ) : shown.length === 0 ? (
          <EmptyState
            title={items.length ? "No chats match" : "No farmers yet"}
            body={items.length ? "Try a different search or filter." : "Register a farmer to start their conversation."}
          />
        ) : (
          <ul>
            {shown.map((c) => (
              <li key={c.farmerId}>
                <button
                  type="button"
                  onClick={() => onSelect(c.farmerId)}
                  aria-current={selectedId === c.farmerId ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors duration-150 focus-visible:bg-sunken focus-visible:outline-none",
                    selectedId === c.farmerId ? "bg-sunken" : "hover:bg-sunken/60"
                  )}
                >
                  <Avatar name={c.name} size={48} />
                  <span className="min-w-0 flex-1 border-b border-hairline pb-2.5 pt-0.5">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[15px] font-medium">{c.name}</span>
                      <span className={cn("shrink-0 text-xs", c.unread ? "font-medium text-success" : "text-muted-foreground")}>
                        {when(c.lastMessage?.at ?? c.lastAt)}
                      </span>
                    </span>
                    <span className="mt-0.5 flex items-center justify-between gap-2">
                      <span lang={c.language} className="truncate text-sm text-muted-foreground">
                        {preview(c)}
                      </span>
                      {c.unread > 0 && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-success px-1.5 text-xs font-medium text-white" aria-label={`${c.unread} unread`}>
                          {c.unread}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

"use client";

import { Fragment, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { EmptyState, ErrorState, Page, PageHeader, SkeletonRows, StatusBadge } from "@/components/feedback/States";
import { apiGet } from "@/lib/fetcher";
import { dateTime, qty, rupees, shortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { CommitmentBar } from "./CommitmentBar";

interface Offer {
  id: string;
  ingredient: string;
  unit: string;
  fpo: string;
  quantity: number;
  pricePerKg: number;
  status: "DRAFT" | "OFFERED" | "ACCEPTED" | "PARTIALLY_COMMITTED" | "FULFILLED" | "CANCELLED";
  neededBy: string;
  sentAt: string | null;
  committed: number;
  delivered: number;
  commitments: { id: string; farmerName: string; village: string; quantity: number; status: string; source: string; at: string }[];
  payment: { status: string; provider: string; amount: number } | null;
}

export const OFFER_STATUS: Record<Offer["status"], { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  DRAFT: { label: "Draft", tone: "neutral" },
  OFFERED: { label: "Offered", tone: "warning" },
  PARTIALLY_COMMITTED: { label: "Partially committed", tone: "warning" },
  ACCEPTED: { label: "Accepted", tone: "success" },
  FULFILLED: { label: "Fulfilled", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

const SOURCE: Record<string, string> = { CHAT: "Chat", VOICE: "Voice", WHATSAPP: "WhatsApp", CONSOLE: "Console" };

export function OrdersView() {
  const [open, setOpen] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["offers"], queryFn: () => apiGet<Offer[]>("/api/demand-offers"), refetchInterval: 4000 });

  return (
    <Page className="space-y-6">
      <PageHeader title="Farm orders" description="Offers sent to farmer groups and what each farmer has committed. Updates live as farmers reply." />
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        {q.isError ? (
          <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <SkeletonRows rows={4} />
        ) : q.data.length === 0 ? (
          <EmptyState title="No orders yet" body="Send an offer from the supply forecast to start one." />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                <th className="w-8 px-2 py-3" />
                <th className="px-4 py-3 font-normal">Order</th>
                <th className="px-4 py-3 font-normal">Needed by</th>
                <th className="px-4 py-3 text-right font-normal">Ordered</th>
                <th className="px-4 py-3 text-right font-normal">Committed</th>
                <th className="px-4 py-3 text-right font-normal">Delivered</th>
                <th className="px-4 py-3 text-right font-normal">Value</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {q.data.map((o) => {
                const s = OFFER_STATUS[o.status];
                const expanded = open === o.id;
                return (
                  <Fragment key={o.id}>
                    <tr
                      className="cursor-pointer hover:bg-sunken/60"
                      onClick={() => setOpen(expanded ? null : o.id)}
                      aria-expanded={expanded}
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setOpen(expanded ? null : o.id))}
                    >
                      <td className="px-2 py-3 text-muted-foreground">
                        <ChevronDown className={cn("size-4 transition-transform duration-150", expanded && "rotate-180")} aria-hidden="true" />
                      </td>
                      <td className="px-4 py-3">
                        <span className="block font-medium">{o.ingredient}</span>
                        <span className="block text-xs text-muted-foreground">
                          {o.fpo}
                          {o.sentAt ? ` · sent ${dateTime(o.sentAt)}` : ""}
                        </span>
                      </td>
                      <td className="px-4 py-3">{shortDate(o.neededBy)}</td>
                      <td className="tabular px-4 py-3 text-right">{qty(o.quantity, o.unit)}</td>
                      <td className="tabular px-4 py-3 text-right">{qty(o.committed, o.unit)}</td>
                      <td className="tabular px-4 py-3 text-right">{qty(o.delivered, o.unit)}</td>
                      <td className="tabular px-4 py-3 text-right">{rupees(o.quantity * o.pricePerKg)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </td>
                    </tr>
                    {expanded && (
                      <tr className="bg-sunken/40">
                        <td />
                        <td colSpan={7} className="space-y-3 px-4 py-4">
                          <div className="max-w-lg">
                            <CommitmentBar total={o.quantity} unit={o.unit} commitments={o.commitments.filter((c) => c.status === "COMMITTED")} compact />
                          </div>
                          {o.commitments.length === 0 ? (
                            <p className="text-muted-foreground">No farmer has answered yet.</p>
                          ) : (
                            <table className="w-full max-w-2xl text-sm">
                              <thead>
                                <tr className="text-left text-xs text-muted-foreground">
                                  <th className="py-1 font-normal">Farmer</th>
                                  <th className="py-1 text-right font-normal">Quantity</th>
                                  <th className="py-1 font-normal">Answer</th>
                                  <th className="py-1 font-normal">Via</th>
                                  <th className="py-1 font-normal">When</th>
                                </tr>
                              </thead>
                              <tbody>
                                {o.commitments.map((c) => (
                                  <tr key={c.id}>
                                    <td className="py-1">
                                      {c.farmerName} <span className="text-muted-foreground">· {c.village}</span>
                                    </td>
                                    <td className="tabular py-1 text-right">{c.status === "COMMITTED" ? qty(c.quantity, o.unit) : "—"}</td>
                                    <td className="py-1">{c.status === "COMMITTED" ? "Committed" : c.status === "DECLINED" ? "Declined" : "Withdrawn"}</td>
                                    <td className="py-1">{SOURCE[c.source] ?? c.source}</td>
                                    <td className="py-1 text-muted-foreground">{dateTime(c.at)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          <p className="text-xs text-muted-foreground">
                            Café payment: {o.payment ? `${o.payment.status.toLowerCase()} (${o.payment.provider === "SIMULATED" ? "simulated" : "Cashfree"})` : "not started"}
                          </p>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Page>
  );
}

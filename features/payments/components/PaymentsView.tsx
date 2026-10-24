"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { DemoChip, EmptyState, ErrorState, Page, PageHeader, SkeletonRows, StatusBadge } from "@/components/feedback/States";
import { apiGet, apiSend } from "@/lib/fetcher";
import { dateTime, qty, rupees } from "@/lib/formatters";

type PayStatus = "PENDING" | "PAID" | "FAILED" | "CANCELLED";

interface Row {
  offerId: string;
  ingredient: string;
  unit: string;
  fpo: string;
  status: string;
  committed: number;
  pricePerKg: number;
  amount: number;
  payment: { id: string; status: PayStatus; provider: "CASHFREE" | "SIMULATED"; paymentSessionId: string | null; lastVerifiedAt: string | null; createdAt: string } | null;
  payouts: { farmerName: string; quantity: number; amount: number; status: string | null; provider: string | null }[];
}

interface PaymentsData {
  cashfree: { configured: boolean; mode: "sandbox" | "production"; payoutsConfigured: boolean };
  rows: Row[];
  audit: { id: string; at: string; actor: string; action: string; detail: Record<string, unknown> | null }[];
}

const PAY_TONE: Record<PayStatus, "success" | "warning" | "danger" | "neutral"> = {
  PENDING: "warning",
  PAID: "success",
  FAILED: "danger",
  CANCELLED: "neutral",
};
const PAY_LABEL: Record<PayStatus, string> = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed", CANCELLED: "Cancelled" };

declare global {
  interface Window {
    Cashfree?: (opts: { mode: "sandbox" | "production" }) => {
      checkout: (opts: { paymentSessionId: string; redirectTarget: "_self" | "_blank" | "_top" | "_modal" }) => Promise<unknown>;
    };
  }
}

function loadCashfreeSdk(): Promise<void> {
  if (window.Cashfree) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = "https://sdk.cashfree.com/js/v3/cashfree.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Couldn't load Cashfree checkout. Check your connection."));
    document.head.appendChild(s);
  });
}

export function PaymentsView() {
  const qc = useQueryClient();
  const router = useRouter();
  const params = useSearchParams();
  const q = useQuery({ queryKey: ["payments"], queryFn: () => apiGet<PaymentsData>("/api/payments"), refetchInterval: 8000 });
  const [confirmSim, setConfirmSim] = useState<Row | null>(null);
  const refresh = () => qc.invalidateQueries({ queryKey: ["payments"] });

  // Returning from Cashfree checkout: confirm on the server, never trust the redirect.
  const verifiedOnce = useRef(false);
  const verifyId = params.get("verify");
  useEffect(() => {
    if (!verifyId || verifiedOnce.current) return;
    verifiedOnce.current = true;
    apiSend<{ status: PayStatus }>(`/api/payments/${verifyId}/verify`)
      .then((r) => {
        if (r.status === "PAID") toast.success("Payment confirmed by Cashfree");
        else toast.info(`Cashfree reports this payment as ${PAY_LABEL[r.status].toLowerCase()}`);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => {
        refresh();
        router.replace("/console/supply/payments");
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verifyId]);

  const collect = useMutation({
    mutationFn: async (row: Row) => {
      const r = await apiSend<{ paymentId: string; provider: "CASHFREE" | "SIMULATED"; paymentSessionId: string | null; mode: "sandbox" | "production" }>(
        "/api/payments",
        { offerId: row.offerId }
      );
      if (r.provider === "CASHFREE" && r.paymentSessionId) {
        await loadCashfreeSdk();
        await window.Cashfree!({ mode: r.mode }).checkout({ paymentSessionId: r.paymentSessionId, redirectTarget: "_self" });
      }
      return r;
    },
    onSuccess: (r) => {
      if (r.provider === "SIMULATED") toast.success("Simulated payment created", { description: "Cashfree isn't configured, so no money will move." });
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const verify = useMutation({
    mutationFn: (id: string) => apiSend<{ status: PayStatus }>(`/api/payments/${id}/verify`),
    onSuccess: (r) => {
      toast.success(`Status checked: ${PAY_LABEL[r.status].toLowerCase()}`);
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const payouts = useMutation({
    mutationFn: (offerId: string) => apiSend<{ created: unknown[]; payoutsConfigured: boolean }>("/api/payments/payouts", { offerId }),
    onSuccess: (r) => {
      toast.success(r.created.length ? `Recorded ${r.created.length} farmer payouts (simulated)` : "Farmer payouts already recorded", {
        description: "No money moved — see the audit log.",
      });
      refresh();
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const markPaid = async () => {
    if (!confirmSim?.payment) return;
    try {
      await apiSend(`/api/payments/${confirmSim.payment.id}/simulate`);
      toast.success("Marked paid (simulated)", { description: "No money moved." });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const data = q.data;
  return (
    <Page className="space-y-8">
      <PageHeader
        title="Payments"
        description="Collect from the café for each committed farm order, then record what each farmer is owed."
        actions={
          data && (
            <DemoChip>
              {data.cashfree.configured ? `Cashfree ${data.cashfree.mode}` : "Cashfree not configured · simulated"}
            </DemoChip>
          )
        }
      />

      <p className="border-l-2 border-hairline pl-3 text-sm text-muted-foreground">
        Collecting from the café (Cashfree payment gateway) is separate from paying farmers. Farmer payouts in this MVP are
        recorded as simulated — no money is sent to farmers from this app.
      </p>

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !data ? (
        <SkeletonRows rows={4} className="rounded-xl border border-hairline bg-surface" />
      ) : data.rows.length === 0 ? (
        <EmptyState
          title="Nothing to collect yet"
          body="Orders appear here once farmers have committed the full quantity. Send an offer from Supply forecast to start."
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-normal">Order</th>
                <th className="px-4 py-3 text-right font-normal">Committed</th>
                <th className="px-4 py-3 text-right font-normal">Amount</th>
                <th className="px-4 py-3 font-normal">Café payment</th>
                <th className="px-4 py-3 font-normal">Farmer payouts</th>
                <th className="px-4 py-3 text-right font-normal">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {data.rows.map((r) => {
                const p = r.payment;
                const paid = p?.status === "PAID";
                const payoutsDone = r.payouts.length > 0 && r.payouts.every((x) => x.status);
                return (
                  <tr key={r.offerId} className="align-top">
                    <td className="px-4 py-3">
                      <span className="block font-medium">{r.ingredient}</span>
                      <span className="block text-xs text-muted-foreground">
                        {r.fpo} · {rupees(r.pricePerKg)}/{r.unit}
                      </span>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{qty(r.committed, r.unit)}</td>
                    <td className="tabular px-4 py-3 text-right font-medium">{rupees(r.amount)}</td>
                    <td className="px-4 py-3">
                      {p ? (
                        <span className="flex flex-col gap-1">
                          <StatusBadge tone={PAY_TONE[p.status]}>
                            {PAY_LABEL[p.status]}
                            {p.provider === "SIMULATED" ? " (simulated)" : ""}
                          </StatusBadge>
                          <span className="text-xs text-muted-foreground">
                            {p.provider === "CASHFREE" ? `Cashfree ${data.cashfree.mode}` : "Simulated — no money moves"}
                            {p.lastVerifiedAt ? ` · checked ${dateTime(p.lastVerifiedAt)}` : ""}
                          </span>
                        </span>
                      ) : (
                        <StatusBadge tone="neutral">Not started</StatusBadge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <ul className="space-y-1">
                        {r.payouts.map((x) => (
                          <li key={x.farmerName} className="flex items-center justify-between gap-3">
                            <span>
                              {x.farmerName} <span className="tabular text-muted-foreground">{rupees(x.amount)}</span>
                            </span>
                            <StatusBadge tone={x.status === "SIMULATED" ? "info" : "neutral"}>
                              {x.status === "SIMULATED" ? "Simulated" : x.status === "NOT_STARTED" ? "Not sent" : "Not recorded"}
                            </StatusBadge>
                          </li>
                        ))}
                      </ul>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-end gap-1.5">
                        {!paid && (!p || p.status === "FAILED" || p.status === "CANCELLED" || (p.provider === "CASHFREE" && p.status === "PENDING")) && (
                          <Button size="sm" onClick={() => collect.mutate(r)} disabled={collect.isPending}>
                            {data.cashfree.configured ? `Collect ${rupees(r.amount)} with Cashfree` : `Create simulated payment of ${rupees(r.amount)}`}
                          </Button>
                        )}
                        {p?.status === "PENDING" && p.provider === "SIMULATED" && (
                          <Button size="sm" onClick={() => setConfirmSim(r)}>
                            Mark paid (simulated)
                          </Button>
                        )}
                        {p && p.provider === "CASHFREE" && !paid && (
                          <Button size="sm" variant="ghost" onClick={() => verify.mutate(p.id)} disabled={verify.isPending}>
                            Check status
                          </Button>
                        )}
                        {paid && !payoutsDone && (
                          <Button size="sm" variant="outline" onClick={() => payouts.mutate(r.offerId)} disabled={payouts.isPending}>
                            Record farmer payouts (simulated)
                          </Button>
                        )}
                        {paid && payoutsDone && <span className="text-xs text-muted-foreground">Settled in this demo</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <section aria-labelledby="audit-h" className="space-y-3">
          <h2 id="audit-h" className="text-base font-semibold">
            Payment audit log
          </h2>
          {data.audit.length === 0 ? (
            <p className="text-sm text-muted-foreground">No payment activity yet.</p>
          ) : (
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface text-sm">
              {data.audit.map((a) => (
                <li key={a.id} className="flex flex-col gap-0.5 px-4 py-2.5 sm:flex-row sm:items-baseline sm:justify-between">
                  <span>
                    <span className="font-medium">{a.action}</span> · {a.actor}
                    {typeof a.detail?.note === "string" && <span className="text-muted-foreground"> · {a.detail.note}</span>}
                  </span>
                  <span className="tabular text-xs text-muted-foreground">{dateTime(a.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <ConfirmDialog
        open={!!confirmSim}
        onOpenChange={(o) => !o && setConfirmSim(null)}
        title="Mark this payment as paid (simulated)?"
        description="Cashfree isn't configured, so this only records a simulated payment for the demo. No money moves, and the audit log will say so."
        confirmLabel="Mark paid (simulated)"
        onConfirm={markPaid}
      />
    </Page>
  );
}

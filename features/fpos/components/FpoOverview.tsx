"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState, ErrorState, Page, PageHeader, SkeletonRows, StatusBadge } from "@/components/feedback/States";
import { CommitmentBar } from "@/features/orders/components/CommitmentBar";
import { apiGet } from "@/lib/fetcher";
import { qty, rupees, shortDate } from "@/lib/formatters";

interface OfferView {
  id: string;
  ingredient: string;
  unit: string;
  quantity: number;
  pricePerKg: number;
  status: string;
  neededBy: string;
  committed: number;
  commitments: { farmerName: string; quantity: number }[];
  declined: string[];
  payment: { status: string; provider: string; amount: number } | null;
}

interface Overview {
  fpo: { id: string; name: string; district: string; state: string };
  farmerCount: number;
  agentCount: number;
  statusCounts: Record<string, number>;
  openOffers: OfferView[];
  offers: OfferView[];
  payouts: { id: string; farmerName: string; ingredient: string; amount: number; status: string; simulated: boolean }[];
}

const ORDER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" }> = {
  OFFERED: { label: "Waiting for farmers", tone: "warning" },
  PARTIALLY_COMMITTED: { label: "Partly committed", tone: "warning" },
  ACCEPTED: { label: "Fully committed", tone: "success" },
  FULFILLED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

function paymentBadge(p: OfferView["payment"]) {
  if (!p) return <StatusBadge tone="neutral">No payment yet</StatusBadge>;
  const sim = p.provider === "SIMULATED";
  const map: Record<string, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
    PAID: { label: sim ? "Paid (simulated)" : "Paid", tone: "success" },
    PENDING: { label: "Payment pending", tone: "warning" },
    FAILED: { label: "Payment failed", tone: "danger" },
    CANCELLED: { label: "Payment cancelled", tone: "neutral" },
  };
  const s = map[p.status] ?? { label: p.status, tone: "neutral" as const };
  return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
}

export function FpoOverview() {
  const fpos = useQuery({ queryKey: ["fpos"], queryFn: () => apiGet<{ id: string; name: string }[]>("/api/fpos") });
  const fpoId = fpos.data?.[0]?.id;
  const q = useQuery({
    queryKey: ["fpo-overview", fpoId],
    queryFn: () => apiGet<Overview>(`/api/fpos/${fpoId}/overview`),
    enabled: !!fpoId,
    refetchInterval: 5000, // commitments arrive from farmer chats
  });

  const error = fpos.error ?? q.error;
  const d = q.data;

  return (
    <Page className="space-y-8">
      <PageHeader
        title={d?.fpo.name ?? "FPO overview"}
        description={d ? `${d.fpo.district}, ${d.fpo.state} · ${d.farmerCount} farmers · ${d.agentCount} field agents` : "Farmers, commitments, order progress and payments"}
        actions={
          <Button asChild variant="ghost">
            <Link href="/kisan/farmers">
              Review farmers <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        }
      />

      {error ? (
        <ErrorState message={(error as Error).message} onRetry={() => (fpos.refetch(), q.refetch())} />
      ) : fpos.data && !fpoId ? (
        <EmptyState title="No FPO linked to your account" body="Ask an admin to connect your account to your FPO." />
      ) : !d ? (
        <div className="space-y-6">
          <div className="h-24 animate-pulse rounded-xl bg-sunken" />
          <SkeletonRows rows={5} className="rounded-xl border border-hairline bg-surface" />
        </div>
      ) : (
        <>
          <section aria-labelledby="open-h" className="space-y-3">
            <h2 id="open-h" className="text-base font-semibold">
              Open café orders
            </h2>
            {d.openOffers.length === 0 ? (
              <div className="rounded-xl border border-hairline bg-surface">
                <EmptyState title="No open orders" body="When a café sends an order to your FPO, matched farmers get it in their chat and their commitments appear here." />
              </div>
            ) : (
              <ul className="grid gap-4 md:grid-cols-2">
                {d.openOffers.map((o) => (
                  <li key={o.id} className="space-y-4 rounded-xl border border-hairline bg-surface p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{o.ingredient}</p>
                        <p className="text-xs text-muted-foreground">
                          Needed by {shortDate(o.neededBy)} · {rupees(o.pricePerKg)}/{o.unit}
                        </p>
                      </div>
                      <StatusBadge tone={(ORDER_STATUS[o.status] ?? ORDER_STATUS.OFFERED).tone}>
                        {(ORDER_STATUS[o.status] ?? { label: o.status }).label}
                      </StatusBadge>
                    </div>
                    <CommitmentBar total={o.quantity} unit={o.unit} commitments={o.commitments} />
                    {o.declined.length > 0 && <p className="text-xs text-muted-foreground">Declined: {o.declined.join(", ")}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-labelledby="progress-h" className="space-y-3">
            <h2 id="progress-h" className="text-base font-semibold">
              Order progress and payments
            </h2>
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
              {d.offers.length === 0 ? (
                <EmptyState title="No orders yet" body="Orders from cafés will be listed here with their payment status." />
              ) : (
                <table className="w-full min-w-[640px] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-normal">Crop</th>
                      <th className="px-4 py-3 text-right font-normal">Ordered</th>
                      <th className="px-4 py-3 text-right font-normal">Committed</th>
                      <th className="px-4 py-3 text-right font-normal">Value</th>
                      <th className="px-4 py-3 font-normal">Order</th>
                      <th className="px-4 py-3 font-normal">Café payment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {d.offers.map((o) => {
                      const s = ORDER_STATUS[o.status] ?? { label: o.status, tone: "neutral" as const };
                      return (
                        <tr key={o.id}>
                          <td className="px-4 py-3">
                            <span className="font-medium">{o.ingredient}</span>
                            <span className="block text-xs text-muted-foreground">Needed by {shortDate(o.neededBy)}</span>
                          </td>
                          <td className="tabular px-4 py-3 text-right">{qty(o.quantity, o.unit)}</td>
                          <td className="tabular px-4 py-3 text-right">{qty(o.committed, o.unit)}</td>
                          <td className="tabular px-4 py-3 text-right">{rupees(o.committed * o.pricePerKg)}</td>
                          <td className="px-4 py-3">
                            <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                          </td>
                          <td className="px-4 py-3">{paymentBadge(o.payment)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          <section aria-labelledby="payouts-h" className="space-y-3">
            <h2 id="payouts-h" className="text-base font-semibold">
              Farmer payouts
            </h2>
            <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
              {d.payouts.length === 0 ? (
                <EmptyState title="No payouts yet" body="Payouts are recorded after a batch is delivered and the café has paid." />
              ) : (
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                      <th className="px-4 py-3 font-normal">Farmer</th>
                      <th className="px-4 py-3 font-normal">Crop</th>
                      <th className="px-4 py-3 text-right font-normal">Amount</th>
                      <th className="px-4 py-3 font-normal">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hairline">
                    {d.payouts.map((p) => (
                      <tr key={p.id}>
                        <td className="px-4 py-3 font-medium">{p.farmerName}</td>
                        <td className="px-4 py-3">{p.ingredient}</td>
                        <td className="tabular px-4 py-3 text-right">{rupees(p.amount)}</td>
                        <td className="px-4 py-3">
                          {p.simulated ? (
                            <StatusBadge tone="neutral">Simulated — no money moved</StatusBadge>
                          ) : (
                            <StatusBadge tone={p.status === "SUCCESS" ? "success" : p.status === "FAILED" ? "danger" : "warning"}>
                              {p.status.charAt(0) + p.status.slice(1).toLowerCase().replace("_", " ")}
                            </StatusBadge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </Page>
  );
}

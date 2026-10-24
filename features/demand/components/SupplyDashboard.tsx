"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { EmptyState, ErrorState, Page, PageHeader, SkeletonRows, StatusBadge } from "@/components/feedback/States";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { apiGet } from "@/lib/fetcher";
import { qty, shortDate, signedQty } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { STATUS_LABEL, type SupplyOverview, type SupplyRow } from "../types";
import { OrdersTrendChart, UsageChart } from "./SupplyCharts";
import { IngredientPanel } from "./IngredientPanel";

export function SupplyDashboard() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["supply"],
    queryFn: () => apiGet<SupplyOverview>("/api/forecasts"),
    refetchInterval: 4000, // farmers reply from the chat — keep commitments live
  });

  const rows = q.data?.rows ?? [];
  // Follow the ingredient with offer activity in the last 2 hours (so a just-filled
  // order stays in view); otherwise the most valuable open need.
  const recent = (r: SupplyRow) =>
    Math.max(0, ...[r.offer?.sentAt, ...(r.offer?.commitments.map((c) => c.at) ?? [])].filter(Boolean).map((t) => Date.parse(t!)));
  const active = rows.filter((r) => r.offer && q.dataUpdatedAt - recent(r) < 2 * 3600_000).sort((a, b) => recent(b) - recent(a))[0];
  const headline = active ?? rows.find((r) => r.farmSourced && r.open > 0) ?? rows[0];
  const selected = rows.find((r) => r.ingredientId === selectedId) ?? null;
  const f = q.data?.forecast;

  return (
    <Page className="space-y-8">
      <PageHeader
        title="Supply forecast"
        description={
          f
            ? `Next 7 days, ${shortDate(f.startDate)}–${shortDate(f.endDate)} · estimated from café orders ${shortDate(f.historyStart)}–${shortDate(f.historyEnd)}`
            : "Ingredient need for the next 7 days, estimated from café orders"
        }
      />

      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <div className="space-y-6">
          <div className="h-28 animate-pulse rounded-xl bg-sunken" />
          <SkeletonRows rows={6} className="rounded-xl border border-hairline bg-surface" />
        </div>
      ) : rows.length === 0 ? (
        <EmptyState title="No sales yet" body="Forecasts appear once cafés have at least a week of QR orders." />
      ) : (
        <>
          {headline && <Headline row={headline} onReview={() => setSelectedId(headline.ingredientId)} />}

          <div className="grid gap-8 lg:grid-cols-2">
            <section aria-labelledby="trend-h" className="space-y-2">
              <h2 id="trend-h" className="text-sm font-medium">
                Café orders per day
              </h2>
              <OrdersTrendChart data={q.data.trend} />
            </section>
            {headline && (
              <section aria-labelledby="usage-h" className="space-y-2">
                <h2 id="usage-h" className="text-sm font-medium">
                  {headline.name} usage and forecast
                </h2>
                <UsageChart row={headline} />
              </section>
            )}
          </div>

          <section aria-labelledby="table-h" className="space-y-3">
            <div className="flex items-baseline justify-between">
              <h2 id="table-h" className="text-base font-semibold">
                Ingredients
              </h2>
              <p className="text-xs text-muted-foreground">Select a row for the calculation and offer</p>
            </div>
            <IngredientTable rows={rows} onSelect={setSelectedId} />
          </section>
        </>
      )}

      <IngredientPanel row={selected} onClose={() => setSelectedId(null)} />
    </Page>
  );
}

function Headline({ row, onReview }: { row: SupplyRow; onReview: () => void }) {
  const dishes = row.contributions.length;
  const cafes = new Set(row.contributions.map((c) => c.cafeName)).size;
  return (
    <section className="flex flex-col gap-4 border-y border-hairline py-6 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-display text-[28px] font-bold leading-tight md:text-[40px]">
          {row.name}: {qty(row.target, row.unit)} needed next week,{" "}
          <span className={row.open > 0 ? "text-warning" : "text-success"}>
            <AnimatedNumber value={row.open} format={(n) => qty(Math.max(0, n), row.unit)} className="tabular" /> still open
          </span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          From {dishes} dishes across {cafes} cafés · {qty(row.stock, row.unit)} on hand ·{" "}
          {row.offer ? `${qty(row.committed, row.unit)} committed by farmers` : "not offered to farmers yet"}
        </p>
      </div>
      <Button onClick={onReview} size="lg" className="shrink-0">
        {row.offer ? `Review ${row.name.toLowerCase()} order` : `Review and send ${row.name.toLowerCase()} offer`}
        <ArrowRight aria-hidden="true" />
      </Button>
    </section>
  );
}

function IngredientTable({ rows, onSelect }: { rows: SupplyRow[]; onSelect: (id: string) => void }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
      <table className="w-full min-w-[760px] whitespace-nowrap text-sm">
        <thead>
          <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
            <th className="px-4 py-3 font-normal">Ingredient</th>
            <th className="px-4 py-3 text-right font-normal">Forecast</th>
            <th className="px-4 py-3 text-right font-normal">Stock</th>
            <th className="px-4 py-3 text-right font-normal">To buy</th>
            <th className="px-4 py-3 text-right font-normal">Committed</th>
            <th className="px-4 py-3 text-right font-normal">Open</th>
            <th className="px-4 py-3 text-right font-normal">Surplus / shortage</th>
            <th className="px-4 py-3 font-normal">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {rows.map((r) => {
            const s = STATUS_LABEL[r.status];
            return (
              <tr
                key={r.ingredientId}
                tabIndex={0}
                onClick={() => onSelect(r.ingredientId)}
                onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(r.ingredientId))}
                className="cursor-pointer transition-colors duration-150 hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none"
                aria-label={`${r.name}: open details`}
              >
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="tabular px-4 py-3 text-right">{qty(r.forecast, r.unit)}</td>
                <td className="tabular px-4 py-3 text-right">{qty(r.stock, r.unit)}</td>
                <td className="tabular px-4 py-3 text-right">{qty(r.target, r.unit)}</td>
                <td className="tabular px-4 py-3 text-right">{r.farmSourced ? qty(r.committed, r.unit) : "—"}</td>
                <td className={cn("tabular px-4 py-3 text-right", r.farmSourced && r.open > 0 && "font-medium text-warning")}>
                  {r.farmSourced ? qty(r.open, r.unit) : "—"}
                </td>
                <td className={cn("tabular px-4 py-3 text-right", r.position < 0 ? "text-danger" : "text-success")}>
                  {signedQty(r.position, r.unit)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

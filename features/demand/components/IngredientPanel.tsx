"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { StatusBadge } from "@/components/feedback/States";
import { CommitmentBar } from "@/features/orders/components/CommitmentBar";
import { apiGet, apiSend } from "@/lib/fetcher";
import { dateTime, qty, rupees } from "@/lib/formatters";
import { STATUS_LABEL, type SupplyRow } from "../types";
import { UsageChart } from "./SupplyCharts";

const adjustForm = z.object({
  quantity: z.coerce.number<string>().min(0, "Can't be negative").max(10000),
  reason: z.string().trim().min(3, "Add a short reason for the audit log"),
});

interface Props {
  row: SupplyRow | null;
  onClose: () => void;
}

export function IngredientPanel({ row, onClose }: Props) {
  return (
    <Sheet open={!!row} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[520px]">
        {row && <PanelBody row={row} />}
      </SheetContent>
    </Sheet>
  );
}

function PanelBody({ row }: { row: SupplyRow }) {
  const qc = useQueryClient();
  const [adjusting, setAdjusting] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const fpos = useQuery({ queryKey: ["fpos"], queryFn: () => apiGet<{ id: string; name: string; farmers: number }[]>("/api/fpos") });
  const fpo = fpos.data?.[0];
  const status = STATUS_LABEL[row.status];

  const send = useMutation({
    mutationFn: () => apiSend<{ quantity: number; notified: string[] }>("/api/demand-offers", { ingredientId: row.ingredientId, fpoId: fpo!.id }),
    onSuccess: (r) => {
      toast.success(`Offer sent to ${fpo!.name}`, { description: `${qty(r.quantity)} of ${row.name.toLowerCase()} · ${r.notified.length} matched farmers notified` });
      qc.invalidateQueries({ queryKey: ["supply"] });
    },
    onError: (e) => toast.error((e as Error).message),
  });

  const cancel = async () => {
    try {
      await apiSend(`/api/demand-offers/${row.offer!.id}/cancel`, { reason: "Cancelled from supply forecast" });
      toast.success("Offer cancelled");
      qc.invalidateQueries({ queryKey: ["supply"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const raw = row.forecast + row.buffer - row.stock;

  return (
    <div className="flex min-h-full flex-col">
      <SheetHeader className="border-b border-hairline p-6">
        <div className="flex items-center gap-3">
          <SheetTitle className="font-display text-[28px] font-bold leading-none">{row.name}</SheetTitle>
          <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
        </div>
        <SheetDescription>
          {qty(row.forecast, row.unit)} forecast for the next 7 days · {rupees(row.pricePerKg)}/{row.unit} farm price
        </SheetDescription>
      </SheetHeader>

      <div className="flex-1 space-y-8 p-6">
        {row.offer ? (
          <section className="space-y-3" aria-labelledby="commit-h">
            <h3 id="commit-h" className="text-sm font-medium">
              Farmer commitments
            </h3>
            <CommitmentBar
              total={row.offer.quantity}
              unit={row.unit}
              commitments={row.offer.commitments.filter((c) => c.status === "COMMITTED")}
            />
            {row.offer.sentAt && (
              <p className="text-xs text-muted-foreground">Offer sent {dateTime(row.offer.sentAt)} · updates live as farmers reply</p>
            )}
          </section>
        ) : null}

        <section className="space-y-3" aria-labelledby="usage-h">
          <h3 id="usage-h" className="text-sm font-medium">
            Daily usage
          </h3>
          <UsageChart row={row} />
        </section>

        <section className="space-y-3" aria-labelledby="calc-h">
          <h3 id="calc-h" className="text-sm font-medium">
            How this was calculated
          </h3>
          <dl className="divide-y divide-hairline rounded-xl border border-hairline text-sm">
            {[
              ["Forecast need, next 7 days", qty(row.forecast, row.unit)],
              [`Safety buffer (${Math.round(row.safetyPct * 100)}%)`, `+ ${qty(row.buffer, row.unit)}`],
              ["On hand across 3 cafés", `− ${qty(row.stock, row.unit)}`],
              ["Suggested purchase", `${qty(Math.max(0, raw), row.unit)} → ${qty(row.suggested, row.unit)}`],
              ...(row.adjusted !== null ? [["Adjusted by café manager", qty(row.adjusted, row.unit)]] : []),
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular text-right font-medium">{v}</dd>
              </div>
            ))}
          </dl>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <caption className="sr-only">Per-dish contributions</caption>
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-2 font-normal">Dish</th>
                  <th className="py-2 pr-2 text-right font-normal">Avg/day</th>
                  <th className="py-2 pr-2 text-right font-normal">Trend</th>
                  <th className="py-2 pr-2 text-right font-normal">Per serving</th>
                  <th className="py-2 text-right font-normal">Need</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {row.contributions.map((c) => (
                  <tr key={c.menuItemId}>
                    <td className="py-2 pr-2">
                      <span className="block">{c.name}</span>
                      <span className="block text-xs text-muted-foreground">{c.cafeName}</span>
                    </td>
                    <td className="tabular py-2 pr-2 text-right">{c.ma14.toFixed(1)}</td>
                    <td className="tabular py-2 pr-2 text-right">×{c.trend.toFixed(2)}</td>
                    <td className="tabular py-2 pr-2 text-right">
                      {c.perServing} {row.unit === "l" ? "ml" : "g"}
                    </td>
                    <td className="tabular py-2 text-right font-medium">{qty(c.quantity, row.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="list-disc space-y-1 pl-5 text-xs leading-relaxed text-muted-foreground">
            <li>Avg/day is the 14-day moving average of servings sold, from café QR orders.</li>
            <li>Trend compares the last 7 days with the last 14, capped at ±10%.</li>
            <li>Each day is scaled by its weekday pattern from the last 28 days (weekends sell more).</li>
            <li>Purchases round up to 0.5 {row.unit} packs. This is an estimate, not guaranteed demand.</li>
          </ul>
        </section>

        {row.adjustments.length > 0 && (
          <section className="space-y-2" aria-labelledby="adj-h">
            <h3 id="adj-h" className="text-sm font-medium">
              Adjustments
            </h3>
            <ul className="space-y-2 text-sm">
              {row.adjustments.map((a) => (
                <li key={a.at} className="text-muted-foreground">
                  <span className="text-foreground">
                    {qty(a.from, row.unit)} → {qty(a.to, row.unit)}
                  </span>{" "}
                  · “{a.reason}” · {a.by}, {dateTime(a.at)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {!row.offer && row.farmSourced && adjusting && (
          <AdjustForm row={row} onDone={() => setAdjusting(false)} />
        )}
      </div>

      {row.farmSourced && (
        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t border-hairline bg-surface p-4">
          {row.offer ? (
            <Button variant="ghost" onClick={() => setConfirmCancel(true)} disabled={row.offer.status === "FULFILLED"}>
              Cancel offer
            </Button>
          ) : (
            <>
              {!adjusting && (
                <Button variant="ghost" onClick={() => setAdjusting(true)}>
                  Adjust quantity
                </Button>
              )}
              <Button onClick={() => send.mutate()} disabled={!fpo || send.isPending || row.target <= 0}>
                <Send aria-hidden="true" />
                {send.isPending ? "Sending…" : `Send ${qty(row.target, row.unit)} offer to ${fpo?.name ?? "FPO"}`}
              </Button>
            </>
          )}
        </div>
      )}
      {!row.farmSourced && (
        <p className="border-t border-hairline p-4 text-sm text-muted-foreground">
          {row.name} comes from a regular supplier, so it isn&apos;t offered to farmer groups.
        </p>
      )}
      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={`Cancel the ${row.name.toLowerCase()} offer?`}
        description="Farmers who committed will see the order as closed. Commitments stay in the audit log."
        confirmLabel="Cancel offer"
        destructive
        onConfirm={cancel}
      />
    </div>
  );
}

function AdjustForm({ row, onDone }: { row: SupplyRow; onDone: () => void }) {
  const qc = useQueryClient();
  const form = useForm({ resolver: zodResolver(adjustForm), defaultValues: { quantity: String(row.target), reason: "" } });
  const submit = form.handleSubmit(async (v) => {
    try {
      await apiSend("/api/forecasts/adjust", { ingredientId: row.ingredientId, quantity: v.quantity, reason: v.reason });
      toast.success(`Quantity adjusted to ${qty(v.quantity, row.unit)}`);
      qc.invalidateQueries({ queryKey: ["supply"] });
      onDone();
    } catch (e) {
      toast.error((e as Error).message);
    }
  });
  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-hairline p-4" noValidate>
      <h3 className="text-sm font-medium">Adjust quantity</h3>
      <div className="space-y-1.5">
        <Label htmlFor="adj-qty">Quantity to order ({row.unit})</Label>
        <Input id="adj-qty" inputMode="decimal" {...form.register("quantity")} aria-invalid={!!form.formState.errors.quantity} />
        {form.formState.errors.quantity && <p className="text-xs text-danger">{form.formState.errors.quantity.message}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="adj-reason">Reason</Label>
        <Textarea id="adj-reason" rows={2} placeholder="e.g. Festival weekend, expecting more footfall" {...form.register("reason")} aria-invalid={!!form.formState.errors.reason} />
        {form.formState.errors.reason && <p className="text-xs text-danger">{form.formState.errors.reason.message}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onDone}>
          Keep suggested
        </Button>
        <Button type="submit" variant="outline" disabled={form.formState.isSubmitting}>
          Save adjustment
        </Button>
      </div>
    </form>
  );
}

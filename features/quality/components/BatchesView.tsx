"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import { Label } from "@/components/shadcn/label";
import { Textarea } from "@/components/shadcn/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { EmptyState, ErrorState, Page, PageHeader, SkeletonRows, StatusBadge } from "@/components/feedback/States";
import { apiGet, apiSend } from "@/lib/fetcher";
import { dateTime, qty, shortDate } from "@/lib/formatters";

interface Batch {
  id: string;
  code: string;
  crop: string;
  farmer: string;
  village: string;
  cafe: string;
  quantity: number;
  harvestDate: string;
  prelimGrade: "A" | "B" | "C";
  finalGrade: "A" | "B" | "C" | null;
  gradeReasons: string[];
  gradeSource: string;
  reviewStatus: "PENDING" | "CONFIRMED" | "CORRECTED";
  pickupStatus: "SCHEDULED" | "PICKED_UP";
  deliveryStatus: "PENDING" | "IN_TRANSIT" | "DELIVERED";
  deliveredAt: string | null;
  photoUrls: string[];
  offerStatus: string;
  reviews: { from: string; to: string; reason: string; by: string; at: string }[];
}

function stage(b: Batch) {
  if (b.deliveryStatus === "DELIVERED") return { tone: "success" as const, label: "Delivered" };
  if (b.reviewStatus === "PENDING") return { tone: "warning" as const, label: "Grade to confirm" };
  if (b.deliveryStatus === "IN_TRANSIT") return { tone: "warning" as const, label: "In transit" };
  if (b.pickupStatus === "PICKED_UP") return { tone: "warning" as const, label: "Picked up" };
  return { tone: "warning" as const, label: "Awaiting pickup" };
}

export function BatchesView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const q = useQuery({ queryKey: ["batches"], queryFn: () => apiGet<Batch[]>("/api/batches"), refetchInterval: 5000 });
  const selected = q.data?.find((b) => b.id === selectedId) ?? null;

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Harvest batches"
        description="Batches farmers logged against their commitments. Grades are preliminary visual checks, not food-safety certificates."
      />
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        {q.isError ? (
          <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
        ) : !q.data ? (
          <SkeletonRows rows={4} />
        ) : q.data.length === 0 ? (
          <EmptyState title="No harvests logged yet" body="When a farmer logs a harvest from the chat, it appears here for grade review and pickup." />
        ) : (
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                <th className="px-4 py-3 font-normal">Batch</th>
                <th className="px-4 py-3 font-normal">Farmer</th>
                <th className="px-4 py-3 text-right font-normal">Quantity</th>
                <th className="px-4 py-3 font-normal">Harvested</th>
                <th className="px-4 py-3 font-normal">Grade</th>
                <th className="px-4 py-3 font-normal">Destination</th>
                <th className="px-4 py-3 font-normal">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {q.data.map((b) => {
                const s = stage(b);
                return (
                  <tr
                    key={b.id}
                    tabIndex={0}
                    onClick={() => setSelectedId(b.id)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSelectedId(b.id))}
                    className="cursor-pointer hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <span className="block font-medium">{b.code}</span>
                      <span className="block text-xs text-muted-foreground">{b.crop}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="block">{b.farmer}</span>
                      <span className="block text-xs text-muted-foreground">{b.village}</span>
                    </td>
                    <td className="tabular px-4 py-3 text-right">{qty(b.quantity)}</td>
                    <td className="px-4 py-3">{shortDate(b.harvestDate)}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{b.finalGrade ?? b.prelimGrade}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        {b.reviewStatus === "PENDING" ? "preliminary" : b.reviewStatus === "CORRECTED" ? "corrected" : "confirmed"}
                      </span>
                    </td>
                    <td className="px-4 py-3">{b.cafe}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      <p className="text-xs text-muted-foreground">No sensor is attached to farm batches — temperature isn&apos;t tracked until the café&apos;s Thermal Debt monitoring takes over on arrival.</p>
      <BatchPanel batch={selected} onClose={() => setSelectedId(null)} />
    </Page>
  );
}

function BatchPanel({ batch, onClose }: { batch: Batch | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [grade, setGrade] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  async function act(body: Record<string, unknown>, done: string) {
    setBusy(true);
    try {
      await apiSend(`/api/batches/${batch!.id}`, body, "PATCH");
      toast.success(done);
      setReason("");
      setGrade("");
      qc.invalidateQueries({ queryKey: ["batches"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const g = grade || batch?.finalGrade || batch?.prelimGrade || "A";
  return (
    <Sheet open={!!batch} onOpenChange={(o) => !o && (onClose(), setGrade(""), setReason(""))}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-[480px]">
        {batch && (
          <>
            <SheetHeader className="border-b border-hairline p-6">
              <SheetTitle className="font-display text-[28px] font-bold leading-none">{batch.code}</SheetTitle>
              <SheetDescription>
                {qty(batch.quantity)} {batch.crop.toLowerCase()} from {batch.farmer}, {batch.village} · to {batch.cafe}
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-6 p-6 text-sm">
              {batch.photoUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={batch.photoUrls[0]} alt={`Harvest photo for ${batch.code}`} className="max-h-60 w-full rounded-lg object-cover" />
              )}
              <section className="space-y-2">
                <h3 className="font-medium">
                  Preliminary grade {batch.prelimGrade}{" "}
                  <span className="font-normal text-muted-foreground">({batch.gradeSource === "demo" ? "demo grade — no model ran" : "from photo, vision model"})</span>
                </h3>
                <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">{batch.gradeReasons.map((r) => <li key={r}>{r}</li>)}</ul>
              </section>

              {batch.deliveryStatus !== "DELIVERED" && (
                <section className="space-y-3 rounded-xl border border-hairline p-4">
                  <h3 className="font-medium">{batch.reviewStatus === "PENDING" ? "Confirm grade at pickup" : "Change grade"}</h3>
                  <div className="grid grid-cols-[96px_1fr] gap-3">
                    <div className="space-y-1.5">
                      <Label htmlFor="grade">Grade</Label>
                      <Select value={g} onValueChange={setGrade}>
                        <SelectTrigger id="grade">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {["A", "B", "C"].map((x) => (
                            <SelectItem key={x} value={x}>
                              {x}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="reason">Reason (audited)</Label>
                      <Textarea id="reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Checked at pickup — matches photo" />
                    </div>
                  </div>
                  <Button
                    variant={batch.reviewStatus === "PENDING" ? "default" : "outline"}
                    disabled={busy || reason.trim().length < 3}
                    onClick={() => act({ action: "review", grade: g, reason }, g === batch.prelimGrade ? `Grade ${g} confirmed` : `Grade corrected to ${g}`)}
                  >
                    {g === batch.prelimGrade ? `Confirm grade ${g}` : `Correct grade to ${g}`}
                  </Button>
                </section>
              )}

              <section className="space-y-2">
                <h3 className="font-medium">Pickup and delivery</h3>
                <ol className="space-y-1 text-muted-foreground">
                  <li>{batch.pickupStatus === "PICKED_UP" ? "✓" : "○"} Picked up from farm</li>
                  <li>{batch.deliveryStatus !== "PENDING" ? "✓" : "○"} In transit</li>
                  <li>{batch.deliveryStatus === "DELIVERED" ? `✓ Delivered ${batch.deliveredAt ? dateTime(batch.deliveredAt) : ""}` : "○ Delivered to café"}</li>
                </ol>
                <div className="flex flex-wrap gap-2 pt-1">
                  {batch.pickupStatus !== "PICKED_UP" && (
                    <Button size="sm" variant="ghost" disabled={busy} onClick={() => act({ action: "pickup" }, "Marked as picked up")}>
                      Mark picked up
                    </Button>
                  )}
                  {batch.deliveryStatus !== "DELIVERED" && (
                    <Button
                      size="sm"
                      variant={batch.reviewStatus === "PENDING" ? "ghost" : "default"}
                      disabled={busy || batch.reviewStatus === "PENDING"}
                      onClick={() => act({ action: "deliver" }, `${batch.code} marked delivered`)}
                    >
                      Mark delivered
                    </Button>
                  )}
                </div>
                {batch.reviewStatus === "PENDING" && batch.deliveryStatus !== "DELIVERED" && (
                  <p className="text-xs text-muted-foreground">Confirm or correct the grade before marking it delivered.</p>
                )}
              </section>

              {batch.reviews.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-medium">Grade history</h3>
                  <ul className="space-y-1 text-muted-foreground">
                    {batch.reviews.map((r) => (
                      <li key={r.at}>
                        {r.from} → {r.to} · “{r.reason}” · {r.by}, {dateTime(r.at)}
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatDateLabel, formatTemp } from "@/lib/format";
import { getBatchThermal, offerPrice } from "@/lib/selectors";
import { useStore } from "@/lib/store";

function downloadCsv(rows: string[][], filename: string) {
  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function ConsoleHeader({ now, pendingCount }: { now: Date; pendingCount: number }) {
  const batches = useStore((s) => s.batches);
  const offers = useStore((s) => s.offers);

  function handleExport() {
    const rows: string[][] = [["section", "id", "name", "detail 1", "detail 2", "detail 3"]];
    for (const batch of Object.values(batches)) {
      const thermal = getBatchThermal(batch, now);
      rows.push([
        "batch",
        batch.id,
        batch.name,
        formatTemp(thermal.currentTemp),
        `${Math.round(thermal.pct * 100)}% debt`,
        thermal.status,
      ]);
    }
    for (const offer of offers) {
      rows.push([
        "offer",
        offer.id,
        offer.dishId,
        `${offer.discountPct}% off`,
        `₹${offerPrice(offer)}`,
        offer.status,
      ]);
    }
    downloadCsv(rows, "coffee-on-qr-report.csv");
  }

  const title =
    pendingCount > 0
      ? `Good evening — ${pendingCount} offer${pendingCount > 1 ? "s" : ""} need${pendingCount > 1 ? "" : "s"} you.`
      : "Good evening — nothing needs you right now.";

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex flex-col gap-1.5">
        <span className="mono-label text-muted">
          The Brew Room Café · {formatDateLabel(now)}
        </span>
        <h1 className="font-display text-2xl font-extrabold md:text-3xl">{title}</h1>
      </div>
      <div className="flex items-center gap-2.5">
        <span className="mono-label rounded-full border border-dashed border-line px-3 py-1.5 text-muted">
          DEMO DATA
        </span>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download size={14} aria-hidden="true" />
          Export report
        </Button>
      </div>
    </div>
  );
}

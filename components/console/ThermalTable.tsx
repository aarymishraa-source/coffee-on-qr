"use client";

import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { StatusChip } from "@/components/ui/StatusChip";
import { formatMinutesShort, formatTemp } from "@/lib/format";
import { getBatchThermal } from "@/lib/selectors";
import type { BatchState } from "@/lib/store";
import type { ThermalStatus } from "@/lib/thermal";

const BAR_COLOR: Record<ThermalStatus, string> = {
  within: "bg-matcha",
  warning: "bg-crema",
  blocked: "bg-signal",
  unknown: "bg-muted/40",
};

function windowLeftLabel(status: ThermalStatus, minutes: number | null): string {
  if (status === "unknown") return "No data";
  if (status === "blocked") return "Ended";
  if (status === "warning") return "Review";
  if (minutes === null) return "—";
  return formatMinutesShort(minutes);
}

interface ThermalTableProps {
  batches: BatchState[];
  now: Date;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
}

export function ThermalTable({ batches, now, selectedId, onSelectRow }: ThermalTableProps) {
  return (
    <Card tone="oat" className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-bold">Batches · Thermal Debt</h2>
        <span className="text-xs text-muted">Cumulative time–temperature exposure vs configured window</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="mono-label border-b border-line text-left text-muted">
              <th className="py-2 pr-4 font-normal">Batch</th>
              <th className="py-2 pr-4 font-normal">Now</th>
              <th className="py-2 pr-4 font-normal">Thermal debt</th>
              <th className="py-2 pr-4 font-normal">Window left</th>
              <th className="py-2 pr-0 font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {batches.map((batch) => {
              const thermal = getBatchThermal(batch, now);
              const pct = Math.min(1, Math.max(0, thermal.pct));
              const isSelected = selectedId === batch.id;
              return (
                <tr
                  key={batch.id}
                  onClick={() => onSelectRow(batch.id)}
                  className={`cursor-pointer border-b border-line/70 last:border-0 transition-colors hover:bg-paper ${
                    isSelected ? "bg-paper" : ""
                  }`}
                >
                  <td className="py-3 pr-4">
                    <div className="font-medium text-espresso">{batch.name}</div>
                    <div className="font-mono text-xs text-muted">
                      #{batch.id} · prep {batch.prepLabel}
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-espresso">
                    {batch.probeOffline ? "—" : formatTemp(thermal.currentTemp)}
                  </td>
                  <td className="py-3 pr-4">
                    <div className="h-2 w-28 overflow-hidden rounded-full bg-line">
                      <motion.div
                        className={`h-full rounded-full ${BAR_COLOR[thermal.status]}`}
                        initial={false}
                        animate={{ width: `${pct * 100}%` }}
                        transition={{ duration: 0.5, ease: "easeOut" }}
                      />
                    </div>
                  </td>
                  <td className="py-3 pr-4 font-mono text-xs text-muted">
                    {windowLeftLabel(thermal.status, thermal.windowLeftMinutes)}
                  </td>
                  <td className="py-3 pr-0">
                    <StatusChip status={thermal.status} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-muted">
        Sensor outages are flagged as Unknown — never green. Blocked batches are excluded from
        all offers.
      </p>
    </Card>
  );
}

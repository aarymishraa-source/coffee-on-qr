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

function DebtBar({ status, pct }: { status: ThermalStatus; pct: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-line">
      <motion.div
        className={`h-full rounded-full ${BAR_COLOR[status]}`}
        initial={false}
        animate={{ width: `${pct * 100}%` }}
        transition={{ duration: 0.5, ease: "easeOut" }}
      />
    </div>
  );
}

interface ThermalTableProps {
  batches: BatchState[];
  now: Date;
  selectedId: string | null;
  onSelectRow: (id: string) => void;
}

export function ThermalTable({ batches, now, selectedId, onSelectRow }: ThermalTableProps) {
  const rows = batches.map((batch) => {
    const thermal = getBatchThermal(batch, now);
    const pct = Math.min(1, Math.max(0, thermal.pct));
    return { batch, thermal, pct };
  });

  return (
    <Card tone="oat" className="flex flex-col gap-4 p-4 sm:p-5 md:p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="font-display text-lg font-bold">Batches · Thermal Debt</h2>
        <span className="hidden text-xs text-muted sm:inline">
          Cumulative time–temperature exposure vs configured window
        </span>
      </div>

      {/* Stacked cards — below md (768px) */}
      <div className="flex flex-col gap-3 md:hidden">
        {rows.map(({ batch, thermal, pct }) => {
          const isSelected = selectedId === batch.id;
          return (
            <button
              key={batch.id}
              type="button"
              data-batch-row={batch.id}
              onClick={() => onSelectRow(batch.id)}
              className={`flex flex-col gap-3 rounded-xl border p-4 text-left transition-colors ${
                isSelected ? "border-forest bg-paper" : "border-line bg-oat"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-medium text-espresso">{batch.name}</div>
                  <div className="font-mono text-xs text-muted">
                    #{batch.id} · prep {batch.prepLabel}
                  </div>
                </div>
                <StatusChip status={thermal.status} />
              </div>
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-mono text-espresso">
                  {batch.probeOffline ? "—" : formatTemp(thermal.currentTemp)}
                </span>
                <span className="font-mono text-xs text-muted">
                  {windowLeftLabel(thermal.status, thermal.windowLeftMinutes)}
                </span>
              </div>
              <DebtBar status={thermal.status} pct={pct} />
            </button>
          );
        })}
      </div>

      {/* Table — md (768px) and up */}
      <div className="hidden overflow-x-auto md:block">
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
            {rows.map(({ batch, thermal, pct }) => {
              const isSelected = selectedId === batch.id;
              return (
                <tr
                  key={batch.id}
                  data-batch-row={batch.id}
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
                    <div className="w-28">
                      <DebtBar status={thermal.status} pct={pct} />
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

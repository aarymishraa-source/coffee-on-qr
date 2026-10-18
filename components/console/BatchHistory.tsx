"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import {
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { StatusChip } from "@/components/ui/StatusChip";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { formatMinutesShort, formatTemp } from "@/lib/format";
import { getBatchThermal } from "@/lib/selectors";
import { THERMAL_LIMIT_C } from "@/lib/thermal";
import type { BatchState } from "@/lib/store";

function hourLabel(ms: number): string {
  const d = new Date(ms);
  let h = d.getHours();
  const suffix = h >= 12 ? "PM" : "AM";
  h = h % 12;
  if (h === 0) h = 12;
  const m = d.getMinutes();
  return m === 0 ? `${h} ${suffix}` : `${h}:${String(m).padStart(2, "0")} ${suffix}`;
}

interface BatchHistoryProps {
  batch: BatchState | null;
  now: Date;
  onClose: () => void;
}

export function BatchHistory({ batch, now, onClose }: BatchHistoryProps) {
  const thermal = batch ? getBatchThermal(batch, now) : null;
  const points = batch
    ? batch.readings.map((r) => ({ ms: r.atMs, label: hourLabel(r.atMs), temp: r.temp }))
    : [];
  const maxTemp = points.length > 0 ? Math.max(...points.map((p) => p.temp)) : THERMAL_LIMIT_C;
  const yMax = Math.max(THERMAL_LIMIT_C + 3, Math.ceil(maxTemp + 2));

  return (
    <AnimatePresence>
      {batch && thermal && (
        <>
          <motion.div
            key="backdrop"
            className="fixed inset-0 z-30 bg-espresso/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            key="panel"
            className="fixed right-0 top-0 z-40 h-full w-full max-w-md overflow-y-auto bg-oat p-6 shadow-2xl"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">{batch.name}</h2>
                <p className="font-mono text-xs text-muted">
                  #{batch.id} · prep {batch.prepLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-signal/15 text-signal transition-colors hover:bg-signal/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <StatusChip status={thermal.status} />
              <span className="font-mono text-2xl font-bold text-espresso">
                {batch.probeOffline ? "—" : formatTemp(thermal.currentTemp)}
              </span>
              <span className="text-sm text-muted">current reading</span>
            </div>

            <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-line bg-paper p-4 text-sm">
              <div>
                <dt className="mono-label text-muted">Thermal debt</dt>
                <dd className="mt-1 font-mono text-base text-espresso">
                  {Math.round(thermal.pct * 100)}%
                </dd>
              </div>
              <div>
                <dt className="mono-label text-muted">Window left</dt>
                <dd className="mt-1 font-mono text-base text-espresso">
                  {thermal.windowLeftMinutes === null
                    ? "No data"
                    : formatMinutesShort(thermal.windowLeftMinutes)}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <MonoLabel>Temperature history</MonoLabel>
              <div className="mt-2 h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={points} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 10, fill: "#6B6F66" }}
                      interval="preserveStartEnd"
                      minTickGap={24}
                    />
                    <YAxis domain={[0, yMax]} tick={{ fontSize: 10, fill: "#6B6F66" }} width={32} />
                    <ReferenceArea y1={THERMAL_LIMIT_C} y2={yMax} fill="#B43A2E" fillOpacity={0.08} />
                    <ReferenceLine
                      y={THERMAL_LIMIT_C}
                      stroke="#B43A2E"
                      strokeDasharray="4 4"
                      strokeWidth={1.5}
                    />
                    <Tooltip
                      formatter={(v) => [`${Number(v).toFixed(1)}°C`, "Temp"]}
                      contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "#E4E0D3" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="temp"
                      stroke="#2E4A2C"
                      strokeWidth={2}
                      dot={{ r: 2.5, fill: "#2E4A2C" }}
                      activeDot={{ r: 4 }}
                      isAnimationActive
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Dashed line marks the {THERMAL_LIMIT_C}°C configured limit — the red band is time
                spent above it. A single reading can look fine; Thermal Debt remembers the whole
                afternoon.
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

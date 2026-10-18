"use client";

import { useState } from "react";
import { FastForward, WifiOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { useStore } from "@/lib/store";

export function SensorSimulator() {
  const batches = useStore((s) => s.batches);
  const setSimTemp = useStore((s) => s.setSimTemp);
  const fastForward30 = useStore((s) => s.fastForward30);
  const toggleProbeOffline = useStore((s) => s.toggleProbeOffline);

  const batchList = Object.values(batches);
  const [selectedId, setSelectedId] = useState(batchList[0]?.id ?? "");
  const selected = batches[selectedId];

  if (!selected) return null;

  return (
    <Card tone="oat" className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold">Sensor simulator</h2>
        <span className="mono-label rounded-full border border-dashed border-line px-2.5 py-1 text-muted">
          DEMO · SENSOR SIMULATOR
        </span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:gap-6">
        <label className="flex flex-col gap-1.5 text-sm">
          <MonoLabel>Batch</MonoLabel>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="rounded-xl border border-line bg-oat px-3 py-2 text-sm text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            {batchList.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name} · #{b.id}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-1 flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <MonoLabel>Temperature</MonoLabel>
            <span className="font-mono text-base font-semibold text-espresso">
              {selected.pendingSimTemp.toFixed(1)}°C
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={15}
            step={0.1}
            value={selected.pendingSimTemp}
            disabled={selected.probeOffline}
            onChange={(e) => setSimTemp(selected.id, Number(e.target.value))}
            className="accent-forest disabled:opacity-40"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
        <Button variant="primary" size="sm" onClick={fastForward30}>
          <FastForward size={15} aria-hidden="true" />
          Fast-forward 30 min
        </Button>
        <Button
          variant={selected.probeOffline ? "danger" : "outline"}
          size="sm"
          onClick={() => toggleProbeOffline(selected.id)}
        >
          <WifiOff size={15} aria-hidden="true" />
          {selected.probeOffline ? "Probe offline" : "Take probe offline"}
        </Button>
      </div>
    </Card>
  );
}

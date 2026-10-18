"use client";

import { useState } from "react";
import { Sidebar, type ConsoleTab } from "@/components/console/Sidebar";
import { ConsoleHeader } from "@/components/console/ConsoleHeader";
import { KpiRow } from "@/components/console/KpiRow";
import { ThermalTable } from "@/components/console/ThermalTable";
import { BatchHistory } from "@/components/console/BatchHistory";
import { SensorSimulator } from "@/components/console/SensorSimulator";
import { ApprovalQueue } from "@/components/console/ApprovalQueue";
import { ForecastChart } from "@/components/console/ForecastChart";
import { LoopStrip } from "@/components/console/LoopStrip";
import { AuditLog } from "@/components/console/AuditLog";
import { ComingInPilot } from "@/components/console/ComingInPilot";
import { useCrossTabSync, useLiveNow, useStore } from "@/lib/store";
import { getConsoleKpis, pendingOffersNeedingAttention } from "@/lib/selectors";

const TAB_TITLES: Record<ConsoleTab, string> = {
  today: "Today",
  batches: "Batches & sensors",
  offers: "Second Serve offers",
  forecast: "Demand forecast",
  menu: "Menu & QR",
  customers: "Customers & loyalty",
  audit: "Audit log",
};

interface ConsoleViewProps {
  /** Renders to fill its parent instead of the viewport — used by /demo, which sizes and scales this itself. */
  embedded?: boolean;
}

export function ConsoleView({ embedded = false }: ConsoleViewProps) {
  const [activeTab, setActiveTab] = useState<ConsoleTab>("today");
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);

  useCrossTabSync();
  const now = useLiveNow();
  const batches = useStore((s) => s.batches);
  const offers = useStore((s) => s.offers);
  const reservations = useStore((s) => s.reservations);

  const kpis = getConsoleKpis(batches, reservations, now);
  const pendingCount = pendingOffersNeedingAttention(offers, batches, now);
  const batchList = Object.values(batches);
  const selectedBatch = selectedBatchId ? batches[selectedBatchId] : null;

  return (
    <div className={`flex bg-paper ${embedded ? "h-full" : "min-h-screen"}`}>
      <Sidebar active={activeTab} onSelect={setActiveTab} />

      <main className="flex-1 overflow-y-auto p-6 md:p-10">
        {activeTab === "today" ? (
          <div className="flex flex-col gap-6">
            <ConsoleHeader now={now} pendingCount={pendingCount} />
            <KpiRow kpis={kpis} />

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
              <ThermalTable
                batches={batchList}
                now={now}
                selectedId={selectedBatchId}
                onSelectRow={setSelectedBatchId}
              />
              <ApprovalQueue now={now} />
            </div>

            <SensorSimulator />

            <div className="rounded-2xl bg-espresso p-5 md:p-6">
              <ForecastChart />
            </div>

            <LoopStrip />
          </div>
        ) : activeTab === "audit" ? (
          <AuditLog />
        ) : (
          <ComingInPilot title={TAB_TITLES[activeTab]} />
        )}
      </main>

      <BatchHistory batch={selectedBatch} now={now} onClose={() => setSelectedBatchId(null)} />
    </div>
  );
}

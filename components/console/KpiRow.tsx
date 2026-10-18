import { Card } from "@/components/ui/Card";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { formatRupees } from "@/lib/format";
import type { ConsoleKpis } from "@/lib/selectors";

interface KpiCardProps {
  label: string;
  value: number;
  format?: (n: number) => string;
  sub: string;
}

function KpiCard({ label, value, format, sub }: KpiCardProps) {
  return (
    <Card tone="oat" className="flex flex-col gap-1.5 p-5">
      <span className="text-sm text-muted">{label}</span>
      <span className="font-display text-3xl font-extrabold">
        <AnimatedNumber value={value} format={format} />
      </span>
      <span className="text-sm text-muted">{sub}</span>
    </Card>
  );
}

export function KpiRow({ kpis }: { kpis: ConsoleKpis }) {
  const statusParts: string[] = [];
  if (kpis.warningCount > 0) statusParts.push(`${kpis.warningCount} warning`);
  if (kpis.blockedCount > 0) statusParts.push(`${kpis.blockedCount} blocked`);
  const statusSub = statusParts.length > 0 ? statusParts.join(" · ") : "All batches within limits";

  const uptimeSub =
    kpis.offlineCount > 0
      ? `${kpis.offlineCount} probe${kpis.offlineCount > 1 ? "s" : ""} offline since ${kpis.offlineSinceLabel}`
      : "All probes online";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <KpiCard
        label="Recovered revenue today"
        value={kpis.recoveredRevenue}
        format={formatRupees}
        sub={`${kpis.secondServeOrders} Second Serve orders`}
      />
      <KpiCard
        label="Predicted surplus"
        value={kpis.predictedSurplusUnits}
        format={(n) => `${Math.round(n)} units`}
        sub={`Across ${kpis.predictedSurplusBatches} batches by close`}
      />
      <KpiCard
        label="Batches monitored"
        value={kpis.batchesMonitored}
        format={(n) => `${Math.round(n)}`}
        sub={statusSub}
      />
      <KpiCard
        label="Sensor uptime"
        value={kpis.sensorUptimePct}
        format={(n) => `${n.toFixed(1)}%`}
        sub={uptimeSub}
      />
    </div>
  );
}

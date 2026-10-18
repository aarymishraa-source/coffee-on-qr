"use client";

import { Card } from "@/components/ui/Card";
import { formatClock } from "@/lib/format";
import { useStore } from "@/lib/store";

export function AuditLog({ compact = false }: { compact?: boolean }) {
  const auditLog = useStore((s) => s.auditLog);
  const entries = compact ? auditLog.slice(0, 5) : auditLog;

  return (
    <Card tone="oat" className="flex flex-col gap-3 p-5 md:p-6">
      <h2 className="font-display text-lg font-bold">Audit log</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-muted">No actions yet this session.</p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {entries.map((entry) => (
            <li key={entry.id} className="flex items-baseline gap-3 border-b border-line/70 pb-2.5 text-sm last:border-0 last:pb-0">
              <span className="font-mono text-xs text-muted">{formatClock(new Date(entry.atMs))}</span>
              <span className="text-espresso">{entry.message}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

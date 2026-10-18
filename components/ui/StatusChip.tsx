import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import type { ThermalStatus } from "@/lib/thermal";

interface StatusChipProps {
  status: ThermalStatus;
  className?: string;
}

const CONFIG: Record<ThermalStatus, { label: string; classes: string; Icon: typeof CheckCircle2 }> = {
  within: { label: "Within limits", classes: "bg-matcha/25 text-forest", Icon: CheckCircle2 },
  warning: { label: "Warning", classes: "bg-crema/20 text-crema", Icon: AlertTriangle },
  blocked: { label: "Blocked", classes: "bg-signal/15 text-signal", Icon: XCircle },
  unknown: { label: "Unknown", classes: "bg-muted/15 text-muted", Icon: HelpCircle },
};

export function StatusChip({ status, className = "" }: StatusChipProps) {
  const { label, classes, Icon } = CONFIG[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${classes} ${className}`}
    >
      <Icon size={14} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

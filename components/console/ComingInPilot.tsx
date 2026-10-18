import { Construction } from "lucide-react";
import { Card } from "@/components/ui/Card";

export function ComingInPilot({ title }: { title: string }) {
  return (
    <Card tone="oat" className="flex flex-col items-center justify-center gap-3 p-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha/20 text-forest">
        <Construction size={22} aria-hidden="true" />
      </div>
      <h2 className="font-display text-xl font-bold">{title}</h2>
      <p className="max-w-sm text-sm text-muted">
        Coming in pilot. This demo focuses on Today — the live sensor, approval and offer loop.
      </p>
    </Card>
  );
}

"use client";

import { motion, useReducedMotion } from "framer-motion";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { qty } from "@/lib/formatters";

const SEGMENT = ["bg-primary", "bg-success", "bg-forest/70", "bg-matcha"];

interface Props {
  total: number;
  unit?: string;
  commitments: { farmerName: string; quantity: number }[];
  compact?: boolean;
}

/**
 * The signature moment: each farmer's commitment fills its share of the bar
 * and "still needed" counts down. Values come from stored commitments.
 */
export function CommitmentBar({ total, unit = "kg", commitments, compact }: Props) {
  const reduce = useReducedMotion();
  const live = commitments.filter((c) => c.quantity > 0);
  const committed = live.reduce((a, c) => a + c.quantity, 0);
  const open = Math.max(0, Math.round((total - committed) * 100) / 100);
  const fmt = (n: number) => qty(Math.max(0, n), unit);

  return (
    <div className="space-y-2">
      <div
        className="flex h-2.5 w-full gap-0.5 overflow-hidden rounded-full bg-sunken"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={committed}
        aria-label={`${qty(committed, unit)} of ${qty(total, unit)} committed`}
      >
        {live.map((c, i) => (
          <motion.div
            key={c.farmerName}
            className={`h-full ${SEGMENT[i % SEGMENT.length]}`}
            initial={reduce ? false : { width: 0 }}
            animate={{ width: `${(c.quantity / total) * 100}%` }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            title={`${c.farmerName}: ${qty(c.quantity, unit)}`}
          />
        ))}
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-muted-foreground">
          <span className="tabular font-medium text-foreground">{qty(committed, unit)}</span> committed of {qty(total, unit)}
        </span>
        <span className={open > 0 ? "text-warning" : "text-success"}>
          {open > 0 ? (
            <>
              <AnimatedNumber value={open} format={fmt} className="tabular font-medium" /> still needed
            </>
          ) : (
            "Fully committed"
          )}
        </span>
      </div>
      {!compact && live.length > 0 && (
        <ul className="space-y-1 text-sm">
          {live.map((c, i) => (
            <li key={c.farmerName} className="flex items-center justify-between">
              <span className="inline-flex items-center gap-2">
                <span className={`size-2 rounded-full ${SEGMENT[i % SEGMENT.length]}`} aria-hidden="true" />
                {c.farmerName}
              </span>
              <span className="tabular text-muted-foreground">{qty(c.quantity, unit)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

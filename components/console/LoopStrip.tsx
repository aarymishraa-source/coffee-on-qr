"use client";

import { LOOP_STEPS } from "@/lib/seed";
import { useStore } from "@/lib/store";

function useActiveStep(): string {
  const offers = useStore((s) => s.offers);
  const reservations = useStore((s) => s.reservations);

  const hasSecondServeReservation = reservations.some((r) => r.secondServe);
  if (hasSecondServeReservation) return "learn";

  const hasApprovedWaiting = offers.some((o) => o.status === "approved");
  if (hasApprovedWaiting) return "offer";

  const hasPending = offers.some((o) => o.status === "pending");
  if (hasPending) return "approval";

  return "gate";
}

export function LoopStrip() {
  const activeId = useActiveStep();

  return (
    <div className="rounded-2xl border border-line bg-oat p-5 md:p-6">
      <h2 className="mono-label mb-4 text-muted">The closed loop</h2>
      {/* Horizontal scroll below md (768px) so six tiles never force the
          page to scroll sideways; a proper wrapping grid from md up. */}
      <div className="-mx-1 flex gap-3 overflow-x-auto px-1 pb-1 md:mx-0 md:grid md:grid-cols-3 md:overflow-visible md:px-0 md:pb-0 xl:grid-cols-6">
        {LOOP_STEPS.map((step, i) => {
          const isActive = step.id === activeId;
          return (
            <div
              key={step.id}
              className={`w-40 shrink-0 rounded-xl border p-3.5 transition-colors md:w-auto ${
                isActive ? "border-matcha bg-matcha/20" : "border-line bg-paper"
              }`}
            >
              <span className="mono-label text-muted">{String(i + 1).padStart(2, "0")}</span>
              <p className={`mt-1 text-sm font-medium ${isActive ? "text-forest" : "text-espresso"}`}>
                {step.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

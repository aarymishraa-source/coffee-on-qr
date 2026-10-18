"use client";

import { ShoppingBag } from "lucide-react";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { DISH_BY_ID } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { formatRupees } from "@/lib/format";
import { readyLabel } from "./shared";

export function OrdersScreen({ onFindFood }: { onFindFood: () => void }) {
  const reservations = useStore((s) => s.reservations);
  const list = [...reservations].reverse();

  return (
    <div className="px-5 pb-6">
      <h1 className="font-display text-[1.85rem] font-extrabold leading-none">Your orders</h1>
      <p className="mt-2 text-sm text-muted">Show your pickup code at the counter.</p>

      {list.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-line p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-paper text-forest">
            <ShoppingBag size={22} />
          </span>
          <p className="mt-3 font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted">Reserve a dish and your pickup code shows up here.</p>
          <button
            type="button"
            onClick={onFindFood}
            className="mt-4 rounded-full bg-espresso px-5 py-2.5 text-sm font-medium text-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            Find something to eat
          </button>
        </div>
      ) : (
        <ul className="mt-5 flex flex-col gap-3">
          {list.map((r) => {
            const dish = DISH_BY_ID[r.dishId];
            return (
              <li key={r.id} className="rounded-2xl border border-line bg-oat p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="leading-tight">
                    <p className="font-semibold">{dish.name}</p>
                    <p className="mt-0.5 text-xs text-muted">{dish.cafeName}</p>
                  </div>
                  <p className="font-display text-lg font-bold leading-none">{formatRupees(r.priceAtReservation)}</p>
                </div>
                <div className="mt-3 flex items-end justify-between">
                  <div>
                    <MonoLabel>PICKUP CODE</MonoLabel>
                    <p className="font-mono text-2xl font-semibold tracking-wider">{r.pickupCode}</p>
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    {r.secondServe && (
                      <span className="rounded-full bg-crema/20 px-2.5 py-0.5 text-[11px] font-medium text-crema">
                        Second Serve
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-forest">
                      <span className="h-2 w-2 rounded-full bg-forest" aria-hidden="true" />
                      Ready at {readyLabel(r)}
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted">+{r.brewPointsEarned} Brew points earned</p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

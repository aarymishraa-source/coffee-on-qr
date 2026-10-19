"use client";

// Small helpers shared by the customer screens. Customers only ever learn
// whether something is on offer — never why a batch was excluded (§9 rule 1).
import { useSyncExternalStore, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, X } from "lucide-react";
import { CAFE_BY_ID, DISH_BY_ID, type Dish } from "@/lib/seed";
import { isOfferable } from "@/lib/thermal";
import { getBatchThermal } from "@/lib/selectors";
import { formatClock } from "@/lib/format";
import type { BatchState, CustomerProfileState, Offer, Reservation } from "@/lib/store";

export type Tab = "home" | "taste" | "order" | "offers" | "profile";

const noopSubscribe = () => () => {};
/** false during SSR + hydration, true after — gates anything read from localStorage. */
export function useMounted(): boolean {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export type LiveStock = number | "available" | "sold-out";

export function liveStock(dishStock: Record<string, number | "available">, dish: Dish): LiveStock {
  const s = dishStock[dish.id];
  if (s === "available") return "available";
  return typeof s === "number" && s > 0 ? s : "sold-out";
}

export function stockLabel(stock: LiveStock): string {
  if (stock === "available") return "Live · available";
  if (stock === "sold-out") return "Sold out";
  return `Live · ${stock} left`;
}

export function cafeLine(dish: Pick<Dish, "cafeId" | "cafeName">): string {
  return `${dish.cafeName} · ${CAFE_BY_ID[dish.cafeId].distanceKm} km`;
}

export function brewPointsFor(price: number): number {
  return Math.round(price * 0.1);
}

/**
 * The one Second Serve offer the customer can see right now, if any:
 * manager-approved, customer opted in, still inside its window, and its
 * batch currently passes the safety gate. Anything else is simply absent.
 */
export function getLiveOffer(
  offers: Offer[],
  batches: Record<string, BatchState>,
  profile: CustomerProfileState,
  now: Date
): Offer | null {
  if (!profile.whatsappOptIn) return null;
  return (
    offers.find((o) => {
      if (o.status !== "approved" || now.getTime() >= o.eligibleUntilMs) return false;
      const batch = batches[o.batchId];
      return Boolean(batch) && isOfferable(getBatchThermal(batch, now).status);
    }) ?? null
  );
}

export function readyLabel(reservation: Reservation): string {
  if (reservation.slotLabel === "In 15 min") {
    return formatClock(new Date(reservation.createdAtMs + 15 * 60_000));
  }
  return reservation.slotLabel;
}


interface SheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  dark?: boolean;
}

/** Bottom sheet that stays inside the phone screen. */
export function Sheet({ open, onClose, children, dark = false }: SheetProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="sheet"
          className="absolute inset-0 z-50 flex flex-col justify-end"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-espresso/50"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            className={`relative max-h-[90dvh] overflow-y-auto rounded-t-3xl px-6 pb-8 pt-5 ${dark ? "bg-espresso text-oat" : "bg-oat text-espresso"}`}
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 320 }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line" />
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full text-muted hover:bg-line/60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            >
              <X size={16} />
            </button>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

interface ReserveSuccessProps {
  open: boolean;
  onClose: () => void;
  onViewOrder: () => void;
  pickupCode: string | null;
  dishId: string | null;
  slotLabel: string;
  points: number;
}

export function ReserveSuccessSheet({
  open,
  onClose,
  onViewOrder,
  pickupCode,
  dishId,
  slotLabel,
  points,
}: ReserveSuccessProps) {
  const dish = dishId ? DISH_BY_ID[dishId] : null;
  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-matcha/30 text-forest">
          <CheckCircle2 size={26} />
        </span>
        <h2 className="font-display text-2xl font-extrabold">Reserved!</h2>
        {dish && (
          <p className="text-sm text-muted">
            {dish.name} · pick up {slotLabel === "In 15 min" ? "in 15 min" : `at ${slotLabel}`} at {dish.cafeName}
          </p>
        )}
        <div className="mt-1 w-full rounded-2xl border border-dashed border-forest/40 bg-paper px-4 py-4">
          <span className="mono-label text-muted">PICKUP CODE</span>
          <p className="font-mono text-3xl font-semibold tracking-wider text-espresso">{pickupCode}</p>
        </div>
        <p className="text-sm font-medium text-forest">+{points} Brew points added</p>
        <div className="mt-2 flex w-full gap-2">
          <button
            type="button"
            onClick={onViewOrder}
            className="flex-1 rounded-full border border-line px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            View order
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-full bg-espresso px-4 py-3 text-sm font-medium text-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
          >
            Done
          </button>
        </div>
      </div>
    </Sheet>
  );
}

/** Square icon button used in screen headers. */
export function IconButton({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-oat text-espresso transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${className}`}
    >
      {children}
    </button>
  );
}

/** App logo tile as drawn in the design: forest rounded square with a matcha-outlined rounded "S". */
export function LogoTile({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 34 34" aria-hidden="true" className="shrink-0">
      <rect width="34" height="34" rx="10" fill="#2E4A2C" />
      <rect x="8.5" y="7" width="17" height="20" rx="6" fill="none" stroke="#A8C47A" strokeWidth="2.4" />
      <path
        d="M19.5 11.5c-1.2-1-4.6-1-4.6 1.4 0 2.6 4.4 1.6 4.4 4.3 0 2.2-3.3 2.4-4.8 1.2"
        fill="none"
        stroke="#A8C47A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

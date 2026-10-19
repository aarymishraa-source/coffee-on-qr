"use client";

import { useState } from "react";
import { ArrowRight, ChevronLeft, Heart, Info, ShieldCheck, AlertTriangle } from "lucide-react";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { DishIllustration } from "@/components/illustrations/Food";
import { DISH_BY_ID, INGREDIENT_BY_ID } from "@/lib/seed";
import { useLiveNow, useStore } from "@/lib/store";
import { formatClock, formatRupees } from "@/lib/format";
import { ReserveSuccessSheet, Sheet, brewPointsFor, cafeLine, liveStock, stockLabel } from "./shared";

const SLOTS = ["In 15 min", "7:00 PM", "7:30 PM"];
const DEFAULT_PREPARED = "10:00 AM";

interface DishDetailProps {
  dishId: string;
  onBack: () => void;
  onViewOrder: () => void;
}

export function DishDetail({ dishId, onBack, onViewOrder }: DishDetailProps) {
  const dish = DISH_BY_ID[dishId];
  const liked = useStore((s) => s.profile.likedIngredientIds);
  const dishStock = useStore((s) => s.dishStock);
  const batches = useStore((s) => s.batches);
  const reserveDish = useStore((s) => s.reserveDish);
  const now = useLiveNow(30_000);

  const [saved, setSaved] = useState(false);
  const [slot, setSlot] = useState(SLOTS[0]);
  const [infoOpen, setInfoOpen] = useState(false);
  const [pickupCode, setPickupCode] = useState<string | null>(null);

  const stock = liveStock(dishStock, dish);
  const soldOut = stock === "sold-out";
  const points = brewPointsFor(dish.price);
  const batch = dish.batchId ? batches[dish.batchId] : undefined;
  const prepared = batch ? formatClock(new Date(batch.prepAtMs)) : DEFAULT_PREPARED;
  // "Updated" is the last 5-minute sync — just that storage is monitored, never a reading.
  const synced = new Date(Math.floor((now.getTime() - 5 * 60_000) / 300_000) * 300_000);

  const handleReserve = () => {
    if (soldOut) return;
    setPickupCode(reserveDish(dish.id, slot));
  };

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-oat">
      <div className="min-h-0 flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="relative bg-forest px-5 pb-12 pt-4 md:pt-9">
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Back"
              onClick={onBack}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-oat/15 text-oat hover:bg-oat/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha"
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              aria-label={saved ? "Remove from saved" : "Save dish"}
              aria-pressed={saved}
              onClick={() => setSaved((v) => !v)}
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-oat/15 text-matcha hover:bg-oat/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha"
            >
              <Heart size={18} fill={saved ? "currentColor" : "none"} />
            </button>
          </div>
          <DishIllustration dishId={dish.id} className="mx-auto mt-1 h-40 w-auto" />
        </div>

        {/* Body */}
        <div className="relative -mt-6 rounded-t-3xl bg-oat px-5 pb-28 pt-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-[1.75rem] font-extrabold leading-[1.05]">{dish.name}</h1>
            <p className="font-display text-[1.75rem] font-extrabold leading-none">{formatRupees(dish.price)}</p>
          </div>
          <p className="mt-1.5 text-sm text-muted">{cafeLine(dish)}</p>

          <div className="mt-4 flex items-center gap-3 rounded-2xl bg-matcha/25 px-4 py-3 text-forest">
            <ShieldCheck size={20} aria-hidden="true" />
            <div className="flex-1 leading-tight">
              <p className="text-sm font-semibold">Storage monitored</p>
              <p className="text-xs">
                Updated {formatClock(synced)} · Prepared {prepared}
              </p>
            </div>
            <button
              type="button"
              aria-label="About storage monitoring"
              onClick={() => setInfoOpen(true)}
              className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-matcha/30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest"
            >
              <Info size={17} />
            </button>
          </div>

          <MonoLabel className="mt-5 block">INGREDIENTS</MonoLabel>
          <div className="mt-2 flex flex-wrap gap-2">
            {dish.ingredientIds.map((id) => {
              const isLiked = liked.includes(id);
              return (
                <span
                  key={id}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                    isLiked ? "bg-espresso text-oat" : "border border-line text-espresso"
                  }`}
                >
                  {isLiked && <Heart size={12} fill="currentColor" aria-label="You liked this" />}
                  {INGREDIENT_BY_ID[id]?.name ?? id}
                </span>
              );
            })}
          </div>
          {dish.allergens.length > 0 && (
            <p className="mt-3 text-sm text-muted">Contains: {dish.allergens.join(", ")}</p>
          )}
          {dish.allergenWarning && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-crema/20 px-3 py-1.5 text-xs font-medium text-crema">
              <AlertTriangle size={13} aria-hidden="true" />
              {dish.allergenWarning}
            </p>
          )}

          <MonoLabel className="mt-5 block">PICK UP</MonoLabel>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {SLOTS.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={slot === s}
                onClick={() => setSlot(s)}
                className={`min-h-11 rounded-2xl py-3.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
                  slot === s ? "border-2 border-espresso font-semibold" : "border border-line"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-medium">
            <span className={`h-2 w-2 rounded-full ${soldOut ? "bg-muted" : "bg-forest"}`} aria-hidden="true" />
            {stockLabel(stock)}
          </p>
        </div>
      </div>

      {/* Sticky reserve bar */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-oat px-5 pb-6 pt-3">
        <div className="leading-tight">
          <p className="text-xs text-muted">Earns</p>
          <p className="text-sm font-semibold">+{points} Brew points</p>
        </div>
        <button
          type="button"
          onClick={handleReserve}
          disabled={soldOut}
          className="inline-flex items-center gap-2 rounded-2xl bg-espresso px-6 py-4 font-semibold text-oat transition-colors hover:bg-espresso/90 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          {soldOut ? "Sold out" : `Reserve · ${formatRupees(dish.price)}`}
          {!soldOut && <ArrowRight size={17} className="text-matcha" />}
        </button>
      </div>

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)}>
        <div className="flex flex-col gap-2 pr-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-matcha/30 text-forest">
            <ShieldCheck size={20} />
          </span>
          <h2 className="font-display text-xl font-extrabold">Storage monitored</h2>
          <p className="text-sm text-muted">
            This café&apos;s storage is monitored by sensors. Staff confirm every batch.
          </p>
        </div>
      </Sheet>

      <ReserveSuccessSheet
        open={pickupCode !== null}
        onClose={() => setPickupCode(null)}
        onViewOrder={() => {
          setPickupCode(null);
          onViewOrder();
        }}
        pickupCode={pickupCode}
        dishId={dish.id}
        slotLabel={slot}
        points={points}
      />
    </div>
  );
}

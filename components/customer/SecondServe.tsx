"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Tag, ShieldCheck } from "lucide-react";
import { Sandwich } from "@/components/illustrations/Food";
import { DISH_BY_ID, INGREDIENT_BY_ID } from "@/lib/seed";
import { useLiveNow, useStore } from "@/lib/store";
import { offerPrice } from "@/lib/selectors";
import { formatClock, formatCountdown, formatRupees } from "@/lib/format";
import { ReserveSuccessSheet, brewPointsFor, cafeLine, getLiveOffer, liveStock } from "./shared";

const FREE_LATTE_AT = 400;
const POINTS_PER_VISIT = 30;

interface SecondServeProps {
  onManage: () => void;
  onViewOrder: () => void;
}

export function SecondServe({ onManage, onViewOrder }: SecondServeProps) {
  const now = useLiveNow(1000);
  const offers = useStore((s) => s.offers);
  const batches = useStore((s) => s.batches);
  const profile = useStore((s) => s.profile);
  const dishStock = useStore((s) => s.dishStock);
  const reservations = useStore((s) => s.reservations);
  const reserveDish = useStore((s) => s.reserveDish);
  const [pickupCode, setPickupCode] = useState<string | null>(null);

  const offer = getLiveOffer(offers, batches, profile, now);
  const dish = offer ? DISH_BY_ID[offer.dishId] : null;
  const price = offer ? offerPrice(offer) : 0;
  const stock = dish ? liveStock(dishStock, dish) : "sold-out";
  const existing = offer
    ? reservations.find((r) => r.secondServe && r.dishId === offer.dishId)
    : undefined;

  const handleReserve = () => {
    if (!offer || stock === "sold-out") return;
    setPickupCode(
      reserveDish(offer.dishId, "In 15 min", { secondServe: true, priceOverride: price, offerId: offer.id })
    );
  };

  const likedNames = dish
    ? dish.ingredientIds
        .filter((id) => profile.likedIngredientIds.includes(id))
        .map((id) => INGREDIENT_BY_ID[id]?.name.toLowerCase() ?? id)
    : [];

  const toLatte = Math.max(0, FREE_LATTE_AT - profile.brewPoints);
  const visitsLeft = Math.ceil(toLatte / POINTS_PER_VISIT);
  const ringPct = Math.min(1, profile.brewPoints / FREE_LATTE_AT);

  return (
    <div className="px-5 pb-6 text-oat">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-matcha text-espresso">
            <Tag size={18} />
          </span>
          <h1 className="font-display text-[1.45rem] font-extrabold">Second Serve</h1>
        </div>
        {offer && <span className="mono-label text-matcha">1 NEW</span>}
      </header>

      {offer && dish ? (
        <motion.div
          key={offer.id}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="mt-5 overflow-hidden rounded-3xl bg-oat text-espresso"
        >
          <div className="relative flex h-40 items-center justify-center bg-crema">
            <span className="absolute left-4 top-4 rounded-full bg-espresso px-3.5 py-1.5 font-display text-lg font-extrabold text-matcha">
              {offer.discountPct}% off
            </span>
            <Sandwich variant="plain" shadow={false} className="mt-4 h-28 w-auto" />
          </div>
          <div className="p-5">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-lg font-semibold leading-tight">{dish.name}</p>
                <p className="mt-0.5 text-xs text-muted">{cafeLine(dish)}</p>
              </div>
              <div className="text-right leading-none">
                <p className="text-xs text-muted line-through">{formatRupees(dish.price)}</p>
                <p className="font-display mt-1 text-[1.9rem] font-extrabold">{formatRupees(price)}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between rounded-xl bg-paper px-3.5 py-2.5 text-sm">
              <span>Eligible till {formatClock(new Date(offer.eligibleUntilMs))}</span>
              <span className="font-mono font-semibold" aria-label="Time left">
                {formatCountdown((offer.eligibleUntilMs - now.getTime()) / 1000)}
              </span>
            </div>
            {existing ? (
              <button
                type="button"
                onClick={onViewOrder}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-matcha py-4 font-semibold text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                <Check size={18} /> Reserved · <span className="font-mono">{existing.pickupCode}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleReserve}
                disabled={stock === "sold-out"}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-espresso py-4 font-semibold text-oat transition-colors hover:bg-espresso/90 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
              >
                {stock === "sold-out" ? "All reserved" : "Reserve now"}
                {stock !== "sold-out" && <ArrowRight size={17} className="text-matcha" />}
              </button>
            )}
          </div>
        </motion.div>
      ) : (
        <div className="mt-5 rounded-3xl border border-oat/15 p-6 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-oat/10 text-matcha">
            <ShieldCheck size={22} />
          </span>
          <p className="font-display mt-3 text-xl font-extrabold">No offers right now</p>
          <p className="mt-2 text-sm text-oat/70">
            We&apos;ll only send you offers that match your taste and pass the café&apos;s safety checks.
          </p>
        </div>
      )}

      {offer && (
        <div className="mt-6">
          <span className="mono-label text-matcha">WHY YOU&apos;RE SEEING THIS</span>
          <ul className="mt-3 flex flex-col gap-2.5 text-sm">
            <li className="flex gap-2.5">
              <Check size={17} className="shrink-0 text-matcha" aria-hidden="true" />
              Matches your taste{likedNames.length > 0 ? ` — ${likedNames.slice(0, 2).join(", ")}` : ""}
            </li>
            <li className="flex gap-2.5">
              <Check size={17} className="shrink-0 text-matcha" aria-hidden="true" />
              Storage checked — within configured limits
            </li>
            <li className="flex gap-2.5">
              <Check size={17} className="shrink-0 text-matcha" aria-hidden="true" />
              Approved by the café manager
            </li>
          </ul>
        </div>
      )}

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-oat/15 p-4">
        <svg viewBox="0 0 48 48" className="h-12 w-12 -rotate-90" aria-hidden="true">
          <circle cx="24" cy="24" r="19" fill="none" stroke="currentColor" strokeOpacity="0.15" strokeWidth="4" />
          <motion.circle
            cx="24"
            cy="24"
            r="19"
            fill="none"
            stroke="#A8C47A"
            strokeWidth="4"
            strokeLinecap="round"
            initial={false}
            animate={{ pathLength: ringPct }}
          />
        </svg>
        <div className="leading-tight">
          <p className="font-semibold">{profile.brewPoints} Brew points</p>
          <p className="mt-0.5 text-xs text-oat/70">
            {visitsLeft > 0
              ? `${visitsLeft} more ${visitsLeft === 1 ? "visit" : "visits"} to a free latte`
              : "Free latte unlocked — ask at the counter"}
          </p>
        </div>
      </div>

      <div className="mt-4 text-xs text-oat/70">
        <p>
          {profile.whatsappOptIn
            ? "You opted in to Second Serve alerts on WhatsApp."
            : "Second Serve alerts on WhatsApp are off."}
        </p>
        <button
          type="button"
          onClick={onManage}
          className="inline-flex min-h-11 items-center text-matcha underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha"
        >
          Manage
        </button>
      </div>

      <ReserveSuccessSheet
        open={pickupCode !== null}
        onClose={() => setPickupCode(null)}
        onViewOrder={() => {
          setPickupCode(null);
          onViewOrder();
        }}
        pickupCode={pickupCode}
        dishId={offer?.dishId ?? null}
        slotLabel="In 15 min"
        points={brewPointsFor(price)}
      />
    </div>
  );
}

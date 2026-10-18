"use client";

import { ArrowRight, MapPin, Tag } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { CAFES, DISHES, DISH_BY_ID, RIYA_PROFILE, SWIPEABLE_INGREDIENT_IDS } from "@/lib/seed";
import { useLiveNow, useStore } from "@/lib/store";
import { offerPrice } from "@/lib/selectors";
import { formatClock, formatRupees } from "@/lib/format";
import { getLiveOffer } from "./shared";

interface HomeScreenProps {
  onContinueTaste: () => void;
  onSeeMatches: () => void;
  onOpenOffers: () => void;
}

export function HomeScreen({ onContinueTaste, onSeeMatches, onOpenOffers }: HomeScreenProps) {
  const now = useLiveNow(5000);
  const offers = useStore((s) => s.offers);
  const batches = useStore((s) => s.batches);
  const profile = useStore((s) => s.profile);

  const total = SWIPEABLE_INGREDIENT_IDS.length;
  const done = profile.swipedIngredientIds.length;
  const offer = getLiveOffer(offers, batches, profile, now);
  const offerDish = offer ? DISH_BY_ID[offer.dishId] : null;
  const greeting = now.getHours() < 12 ? "Good morning" : now.getHours() < 17 ? "Good afternoon" : "Good evening";

  return (
    <div className="flex flex-col gap-4 px-5 pb-6">
      <header className="flex items-center gap-2.5">
        <Logo withWordmark={false} size={34} />
        <div className="leading-tight">
          <p className="text-xs text-muted">{greeting}</p>
          <p className="text-sm font-semibold">{RIYA_PROFILE.name}</p>
        </div>
      </header>

      <h1 className="font-display mt-1 text-[1.85rem] font-extrabold leading-[1.05]">
        Taste, matched.
        <br />
        Nothing wasted.
      </h1>

      <button
        type="button"
        onClick={done >= total ? onSeeMatches : onContinueTaste}
        className="rounded-3xl bg-forest p-5 text-left text-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
      >
        <MonoLabel className="text-matcha">TASTE MATCH</MonoLabel>
        <p className="font-display mt-2 text-xl font-extrabold">
          {done >= total ? "Your taste profile is ready" : "Continue your taste profile"}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-oat/15">
            <div className="h-full rounded-full bg-matcha" style={{ width: `${(done / total) * 100}%` }} />
          </div>
          <span className="font-mono text-xs text-oat/70">
            {done} / {total}
          </span>
        </div>
        <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-matcha">
          {done >= total ? "See my matches" : "Keep swiping"} <ArrowRight size={15} />
        </p>
      </button>

      {offer && offerDish && (
        <button
          type="button"
          onClick={onOpenOffers}
          className="flex items-center gap-3 rounded-3xl bg-espresso p-4 text-left text-oat focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-matcha text-espresso">
            <Tag size={18} />
          </span>
          <span className="flex-1 leading-tight">
            <MonoLabel className="text-matcha">SECOND SERVE · 1 NEW</MonoLabel>
            <span className="mt-1 block font-semibold">
              {offerDish.name} · {offer.discountPct}% off · {formatRupees(offerPrice(offer))}
            </span>
            <span className="text-xs text-oat/70">Till {formatClock(new Date(offer.eligibleUntilMs))}</span>
          </span>
          <ArrowRight size={18} className="text-matcha" />
        </button>
      )}

      <section>
        <MonoLabel>NEARBY CAFÉS</MonoLabel>
        <ul className="mt-2 flex flex-col gap-2">
          {CAFES.map((cafe) => (
            <li key={cafe.id} className="flex items-center gap-3 rounded-2xl border border-line bg-oat p-3.5">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper text-forest">
                <MapPin size={18} />
              </span>
              <div className="flex-1 leading-tight">
                <p className="font-semibold">{cafe.name}</p>
                <p className="text-xs text-muted">
                  {cafe.distanceKm} km · {DISHES.filter((d) => d.cafeId === cafe.id).length} dishes on Taste Match
                </p>
              </div>
              <span className="rounded-full bg-matcha/25 px-2.5 py-1 text-xs font-medium text-forest">
                {cafe.open ? "Open" : "Closed"}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

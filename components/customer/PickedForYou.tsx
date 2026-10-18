"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Map as MapIcon } from "lucide-react";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { Chip } from "@/components/ui/Chip";
import { CAFE_BY_ID, DISHES, FEATURED_PICKS_DEFAULT, INGREDIENT_BY_ID } from "@/lib/seed";
import { rankDishesForDisplay, type RankedDish } from "@/lib/match";
import { useStore } from "@/lib/store";
import { formatRupees } from "@/lib/format";
import { IconButton, cafeLine, liveStock, stockLabel } from "./shared";

const TILE_TONES: Record<string, string> = {
  "pesto-paneer-sandwich": "bg-forest",
  "iced-latte": "bg-crema",
  "blueberry-muffin": "bg-matcha",
  "veg-sandwich": "bg-crema",
  "paneer-tikka-bowl": "bg-forest",
  "creamy-mushroom-pasta": "bg-matcha",
  "grilled-chicken-bowl": "bg-crema",
  "chilli-garlic-noodles": "bg-forest",
};

interface Filters {
  veg: boolean;
  under: boolean;
  lessSpicy: boolean;
  openNow: boolean;
}

interface PickedForYouProps {
  onBack: () => void;
  onOpenDish: (dishId: string) => void;
  onOpenMap: () => void;
}

export function PickedForYou({ onBack, onOpenDish, onOpenMap }: PickedForYouProps) {
  const profile = useStore((s) => s.profile);
  const dishStock = useStore((s) => s.dishStock);
  const [filters, setFilters] = useState<Filters>({ veg: true, under: false, lessSpicy: false, openNow: false });

  const toggle = (key: keyof Filters) => setFilters((f) => ({ ...f, [key]: !f[key] }));

  const pool = DISHES.filter(
    (d) =>
      (!filters.under || d.price <= profile.budget) &&
      (!filters.lessSpicy || d.spice !== "spicy") &&
      (!filters.openNow || CAFE_BY_ID[d.cafeId].open)
  );
  // "Veg only" off lifts the diet filter so non-veg dishes can appear.
  const matchProfile = { ...profile, diet: filters.veg ? profile.diet : ("non-veg" as const) };
  const featured = profile.swipedIngredientIds.length === 0 ? FEATURED_PICKS_DEFAULT : [];
  const ranked = rankDishesForDisplay(pool, matchProfile, (d) => liveStock(dishStock, d), featured);
  // Sold-out dishes drop to the bottom (stable sort keeps match order otherwise).
  const list = [...ranked].sort((a, b) => Number(a.stock === "sold-out") - Number(b.stock === "sold-out"));

  return (
    <div className="px-5 pb-6">
      <header className="flex items-center justify-between">
        <IconButton label="Back to taste cards" onClick={onBack}>
          <ChevronLeft size={20} />
        </IconButton>
        <MonoLabel>TASTE PROFILE READY</MonoLabel>
        <IconButton label="Nearby cafés" onClick={onOpenMap}>
          <MapIcon size={18} />
        </IconButton>
      </header>

      <h1 className="font-display mt-5 text-[1.85rem] font-extrabold leading-none">Picked for you</h1>
      <p className="mt-2 text-sm text-muted">Ranked by your taste and what&apos;s actually in stock right now.</p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Chip onClick={() => toggle("veg")} active={filters.veg}>Veg only</Chip>
        <Chip onClick={() => toggle("under")} active={filters.under}>Under {formatRupees(profile.budget)}</Chip>
        <Chip onClick={() => toggle("lessSpicy")} active={filters.lessSpicy}>Less spicy</Chip>
        <Chip onClick={() => toggle("openNow")} active={filters.openNow}>Open now</Chip>
      </div>

      <ul className="mt-4 flex flex-col gap-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {list.map((dish) => (
            <motion.li
              key={dish.id}
              layout
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 380, damping: 34 }}
            >
              <DishRow dish={dish} liked={profile.likedIngredientIds} onOpen={() => onOpenDish(dish.id)} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
      {list.length === 0 && (
        <p className="mt-6 text-center text-sm text-muted">Nothing matches these filters right now. Try turning one off.</p>
      )}
    </div>
  );
}

// The design's "why" line names at most two liked ingredients, lower-case mid-sentence
// ("Because you liked basil pesto and paneer"). Curated lines (whyOverride) pass through.
function whyLine(dish: RankedDish, liked: string[]): string {
  if (dish.whyOverride) return dish.whyOverride;
  const names = dish.ingredientIds
    .filter((id) => liked.includes(id))
    .slice(0, 2)
    .map((id) => (INGREDIENT_BY_ID[id]?.name ?? id).toLowerCase());
  return names.length ? `Because you liked ${names.join(" and ")}` : dish.match.why;
}

function DishRow({ dish, liked, onOpen }: { dish: RankedDish; liked: string[]; onOpen: () => void }) {
  const soldOut = dish.stock === "sold-out";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`flex w-full gap-3 rounded-2xl border border-line bg-oat p-3 text-left transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-forest ${
        soldOut ? "opacity-60" : ""
      }`}
    >
      <div className={`relative h-[104px] w-[100px] shrink-0 rounded-xl ${TILE_TONES[dish.id] ?? "bg-forest"}`}>
        <span className="absolute bottom-2 left-2 rounded-full bg-oat px-2 py-0.5 font-mono text-[10px] text-espresso">
          {dish.match.display}% match
        </span>
      </div>
      <div className="flex min-w-0 flex-1 flex-col py-0.5">
        <div className="flex items-start justify-between gap-2">
          <p className="font-semibold leading-tight">{dish.name}</p>
          <p className="font-display text-lg font-bold leading-none">{formatRupees(dish.price)}</p>
        </div>
        <p className="mt-1 text-xs text-muted">{cafeLine(dish)}</p>
        <p className="mt-1 text-xs leading-snug text-forest">{whyLine(dish, liked)}</p>
        {dish.allergenWarning && (
          <p className="mt-1 text-[11px] leading-snug text-crema">{dish.allergenWarning}</p>
        )}
        <p className="mt-auto flex items-center gap-1.5 pt-1.5 text-xs font-medium">
          <span className={`h-2 w-2 rounded-full ${soldOut ? "bg-muted" : "bg-forest"}`} aria-hidden="true" />
          {stockLabel(dish.stock)}
        </p>
      </div>
    </button>
  );
}

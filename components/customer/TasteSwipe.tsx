"use client";

import { useEffect, useRef, type RefObject } from "react";
import {
  animate,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import { Heart, SlidersHorizontal, X, ArrowRight, Sparkles } from "lucide-react";
import { LeafCircle } from "@/components/illustrations/Food";
import { CAFES, INGREDIENT_BY_ID, SWIPEABLE_INGREDIENT_IDS, type Ingredient } from "@/lib/seed";
import { useStore, type SwipeDirection } from "@/lib/store";
import { IconButton, LogoTile } from "./shared";

const MIN_SWIPES_FOR_MATCHES = 5;

interface TasteSwipeProps {
  onSeeMatches: () => void;
}

export function TasteSwipe({ onSeeMatches }: TasteSwipeProps) {
  const swiped = useStore((s) => s.profile.swipedIngredientIds);
  const swipeIngredient = useStore((s) => s.swipeIngredient);
  const flyRef = useRef<((dir: SwipeDirection) => void) | null>(null);

  const total = SWIPEABLE_INGREDIENT_IDS.length;
  const remaining = SWIPEABLE_INGREDIENT_IDS.filter((id) => !swiped.includes(id));
  const count = total - remaining.length;
  const top = remaining[0] ? INGREDIENT_BY_ID[remaining[0]] : null;
  const next = remaining[1] ? INGREDIENT_BY_ID[remaining[1]] : null;
  const openCafes = CAFES.filter((c) => c.open).length;

  const handleDecide = (id: string, dir: SwipeDirection) => {
    swipeIngredient(id, dir);
    if (count + 1 >= total) onSeeMatches();
  };

  return (
    <div className="flex h-full flex-col px-5 pb-3">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <LogoTile />
          <div className="leading-tight">
            <p className="text-xs text-muted">Good evening</p>
            <p className="text-sm font-semibold">{openCafes} cafés open near you</p>
          </div>
        </div>
        <IconButton label="See my matches" onClick={onSeeMatches}>
          <SlidersHorizontal size={18} />
        </IconButton>
      </header>

      <h1 className="font-display mt-5 text-[1.85rem] font-extrabold leading-[1.05]">
        What are you
        <br />
        craving tonight?
      </h1>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={count} aria-label="Taste profile progress">
          <motion.div
            className="h-full rounded-full bg-forest"
            initial={false}
            animate={{ width: `${(count / total) * 100}%` }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
          />
        </div>
        <span className="font-mono text-xs text-muted">
          {count} / {total}
        </span>
      </div>

      {/* Card stack */}
      <div className="relative mt-5 min-h-0 flex-1">
        {top ? (
          <>
            <div className="absolute inset-x-6 bottom-[-10px] top-6 rotate-[-3deg] rounded-3xl bg-crema" aria-hidden="true" />
            <div className="absolute inset-x-6 bottom-[-12px] top-6 rotate-[2.5deg] rounded-3xl bg-matcha/70" aria-hidden="true" />
            {next && (
              <div className="absolute inset-0 origin-bottom scale-[0.96]" aria-hidden="true">
                <IngredientCardFace ingredient={next} />
              </div>
            )}
            <SwipeCard
              key={top.id}
              ingredient={top}
              flyRef={flyRef}
              onDecide={(dir) => handleDecide(top.id, dir)}
            />
          </>
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-3xl bg-forest p-6 text-center text-oat">
            <Sparkles className="text-matcha" size={28} />
            <p className="font-display text-2xl font-extrabold">Taste profile ready</p>
            <p className="text-sm text-oat/70">All {total} ingredients done. Your matches are waiting.</p>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-6 flex items-center justify-center gap-5">
        <button
          type="button"
          aria-label="Skip"
          disabled={!top}
          onClick={() => flyRef.current?.("skip")}
          className="flex h-16 w-16 items-center justify-center rounded-full border border-line bg-oat text-signal transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <X size={24} strokeWidth={2.2} />
        </button>
        <button
          type="button"
          aria-label="Not sure"
          disabled={!top}
          onClick={() => flyRef.current?.("unsure")}
          className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-oat text-sm text-muted transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          ?
        </button>
        <button
          type="button"
          aria-label="Like"
          disabled={!top}
          onClick={() => flyRef.current?.("like")}
          className="flex h-16 w-16 items-center justify-center rounded-full bg-espresso text-matcha transition-transform active:scale-95 disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
        >
          <Heart size={22} strokeWidth={2.2} />
        </button>
      </div>

      <div className="mt-2 flex h-9 items-center justify-center">
        {(count >= MIN_SWIPES_FOR_MATCHES || !top) && (
          <motion.button
            type="button"
            onClick={onSeeMatches}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-matcha px-4 py-2 text-sm font-semibold text-espresso focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest"
          >
            See my matches <ArrowRight size={15} />
          </motion.button>
        )}
        {count < MIN_SWIPES_FOR_MATCHES && top && (
          <p className="text-xs text-muted">
            Swipe {MIN_SWIPES_FOR_MATCHES - count} more to see your matches
          </p>
        )}
      </div>
    </div>
  );
}

function IngredientCardFace({ ingredient }: { ingredient: Ingredient }) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-3xl bg-forest p-5 text-oat shadow-[0_12px_30px_-12px_rgba(24,33,26,0.45)]">
      <div className="flex shrink-0 items-center justify-between">
        <span className="mono-label text-matcha">INGREDIENT</span>
        <span className="rounded-full bg-oat/10 px-2.5 py-1 text-xs">
          {ingredient.diet === "veg" ? "Veg" : "Non-veg"}
        </span>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center py-3">
        <LeafCircle className="h-full max-h-[160px] w-auto" />
      </div>
      <h2 className="font-display shrink-0 text-[2rem] font-extrabold leading-none">{ingredient.name}</h2>
      <p className="mt-2 shrink-0 text-sm text-oat/75">{ingredient.notes.join(" · ")}</p>
      <div className="mt-3 flex shrink-0 flex-wrap gap-2">
        <span className="rounded-full border border-oat/25 px-2.5 py-1 text-xs">
          In dishes at {ingredient.cafeCount} {ingredient.cafeCount === 1 ? "café" : "cafés"}
        </span>
        {ingredient.allergens.map((a) => (
          <span key={a} className="rounded-full border border-oat/25 px-2.5 py-1 text-xs">
            Contains {a}
          </span>
        ))}
      </div>
    </div>
  );
}

interface SwipeCardProps {
  ingredient: Ingredient;
  onDecide: (dir: SwipeDirection) => void;
  flyRef: RefObject<((dir: SwipeDirection) => void) | null>;
}

function SwipeCard({ ingredient, onDecide, flyRef }: SwipeCardProps) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const opacity = useMotionValue(1);
  const rotate = useTransform(x, [-240, 240], [-16, 16]);
  const likeOpacity = useTransform(x, [25, 110], [0, 1]);
  const skipOpacity = useTransform(x, [-110, -25], [1, 0]);
  const leaving = useRef(false);

  useEffect(() => {
    const fly = (dir: SwipeDirection) => {
      if (leaving.current) return;
      leaving.current = true;
      const done = () => onDecide(dir);
      if (dir === "unsure") {
        animate(opacity, 0, { duration: 0.3 });
        animate(y, -80, { duration: 0.3 }).then(done);
      } else {
        animate(x, dir === "like" ? 520 : -520, { duration: 0.32, ease: "easeIn" }).then(done);
      }
    };
    flyRef.current = fly;
    return () => {
      if (flyRef.current === fly) flyRef.current = null;
    };
  }, [flyRef, onDecide, opacity, x, y]);

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    if (info.offset.x > 110 || info.velocity.x > 650) flyRef.current?.("like");
    else if (info.offset.x < -110 || info.velocity.x < -650) flyRef.current?.("skip");
    else animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
  };

  return (
    <motion.div
      data-swipe-card
      className="absolute inset-0 cursor-grab touch-none active:cursor-grabbing"
      style={{ x, y, rotate, opacity }}
      drag="x"
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.96 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300, damping: 26 }}
    >
      <IngredientCardFace ingredient={ingredient} />
      <motion.span
        style={{ opacity: likeOpacity }}
        className="pointer-events-none absolute left-5 top-12 rotate-[-12deg] rounded-lg border-[3px] border-matcha px-3 py-1 font-display text-2xl font-extrabold text-matcha"
      >
        LIKE
      </motion.span>
      <motion.span
        style={{ opacity: skipOpacity }}
        className="pointer-events-none absolute right-5 top-12 rotate-[12deg] rounded-lg border-[3px] border-signal bg-oat/90 px-3 py-1 font-display text-2xl font-extrabold text-signal"
      >
        SKIP
      </motion.span>
    </motion.div>
  );
}

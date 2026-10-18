"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle } from "lucide-react";
import { DISH_BY_ID } from "@/lib/seed";
import { useLiveNow, useStore } from "@/lib/store";
import { offerPrice } from "@/lib/selectors";
import { formatClock, formatRupees } from "@/lib/format";
import { BottomNav } from "./BottomNav";
import { TasteSwipe } from "./TasteSwipe";
import { PickedForYou } from "./PickedForYou";
import { DishDetail } from "./DishDetail";
import { SecondServe } from "./SecondServe";
import { HomeScreen } from "./HomeScreen";
import { OrdersScreen } from "./OrdersScreen";
import { ProfileScreen } from "./ProfileScreen";
import { getLiveOffer, type Tab } from "./shared";

const STORE_KEY = "coffee-on-qr-demo";
const BANNER_MS = 7000;

/**
 * The whole customer app as one self-contained screen. Navigation is local
 * state (not URLs) so /demo can drop it straight into its phone frame.
 */
export function CustomerApp() {
  const [tab, setTab] = useState<Tab>("taste");
  const [tasteView, setTasteView] = useState<"swipe" | "picked">("swipe");
  const [dishId, setDishId] = useState<string | null>(null);
  const [bannerOfferId, setBannerOfferId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const now = useLiveNow(5000);
  const offers = useStore((s) => s.offers);
  const batches = useStore((s) => s.batches);
  const profile = useStore((s) => s.profile);
  const liveOffer = getLiveOffer(offers, batches, profile, now);

  // A newly approved offer drops in as a WhatsApp-style banner.
  useEffect(
    () =>
      useStore.subscribe((state, prev) => {
        if (!state.profile.whatsappOptIn) return;
        const fresh = state.offers.find(
          (o) => o.status === "approved" && prev.offers.find((p) => p.id === o.id)?.status !== "approved"
        );
        if (fresh) setBannerOfferId(fresh.id);
      }),
    []
  );

  useEffect(() => {
    if (!bannerOfferId) return;
    const id = setTimeout(() => setBannerOfferId(null), BANNER_MS);
    return () => clearTimeout(id);
  }, [bannerOfferId]);

  // Keep /app in sync when /console runs in another tab or window.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_KEY) void useStore.persist.rehydrate();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const go = (next: Tab) => {
    setDishId(null);
    setTab(next);
    scrollRef.current?.scrollTo({ top: 0 });
  };

  const showPicked = () => {
    setTasteView("picked");
    go("taste");
  };

  const bannerOffer = offers.find((o) => o.id === bannerOfferId);
  const bannerDish = bannerOffer ? DISH_BY_ID[bannerOffer.dishId] : null;
  const dark = tab === "offers";

  return (
    <div className={`relative flex h-full flex-col overflow-hidden transition-colors ${dark ? "bg-espresso" : "bg-paper"}`}>
      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto pt-4 md:pt-10">
        {tab === "home" && (
          <HomeScreen
            onContinueTaste={() => {
              setTasteView("swipe");
              go("taste");
            }}
            onSeeMatches={showPicked}
            onOpenOffers={() => go("offers")}
          />
        )}
        {tab === "taste" &&
          (tasteView === "swipe" ? (
            <TasteSwipe onSeeMatches={showPicked} />
          ) : (
            <PickedForYou
              onBack={() => setTasteView("swipe")}
              onOpenDish={setDishId}
              onOpenMap={() => go("home")}
            />
          ))}
        {tab === "order" && <OrdersScreen onFindFood={showPicked} />}
        {tab === "offers" && <SecondServe onManage={() => go("profile")} onViewOrder={() => go("order")} />}
        {tab === "profile" && <ProfileScreen />}
      </div>

      <BottomNav active={tab} onChange={go} dark={dark} offerDot={Boolean(liveOffer)} />

      {dishId && <DishDetail dishId={dishId} onBack={() => setDishId(null)} onViewOrder={() => go("order")} />}

      <AnimatePresence>
        {bannerOffer && bannerDish && (
          <motion.button
            key={bannerOffer.id}
            type="button"
            onClick={() => {
              setBannerOfferId(null);
              go("offers");
            }}
            initial={{ y: -120, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            onDragEnd={(_, info) => info.offset.y < -30 && setBannerOfferId(null)}
            className="absolute inset-x-3 top-3 z-[60] flex gap-3 rounded-2xl bg-oat/95 p-3 text-left shadow-[0_12px_32px_-8px_rgba(24,33,26,0.45)] backdrop-blur md:top-9"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366] text-white">
              <MessageCircle size={18} fill="currentColor" />
            </span>
            <span className="min-w-0 flex-1 leading-snug">
              <span className="flex items-center justify-between text-[11px] text-muted">
                <span className="font-semibold uppercase tracking-wide">WhatsApp</span>
                <span>now</span>
              </span>
              <span className="mt-0.5 block text-[13px] text-espresso">
                <strong>Coffee on QR:</strong> {bannerDish.name} is {bannerOffer.discountPct}% off at{" "}
                {bannerDish.cafeName} till {formatClock(new Date(bannerOffer.eligibleUntilMs)).replace(":00", "")} —{" "}
                {formatRupees(offerPrice(bannerOffer))}. Reply or tap to reserve.
              </span>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { Heart, MessageCircle } from "lucide-react";
import { MonoLabel } from "@/components/ui/MonoLabel";
import { INGREDIENT_BY_ID, RIYA_PROFILE } from "@/lib/seed";
import { useStore } from "@/lib/store";
import { formatRupees } from "@/lib/format";

export function ProfileScreen() {
  const profile = useStore((s) => s.profile);
  const addAuditEntry = useStore((s) => s.addAuditEntry);

  // No dedicated store action for this — a direct setState keeps lib/store.ts untouched.
  const toggleWhatsapp = () => {
    const next = !profile.whatsappOptIn;
    useStore.setState((s) => ({ profile: { ...s.profile, whatsappOptIn: next } }));
    addAuditEntry(`Customer ${RIYA_PROFILE.name} turned Second Serve WhatsApp alerts ${next ? "on" : "off"}`);
  };

  return (
    <div className="flex flex-col gap-5 px-5 pb-6">
      <header className="flex items-center gap-3">
        <span className="font-display flex h-14 w-14 items-center justify-center rounded-full bg-forest text-2xl font-extrabold text-matcha">
          {RIYA_PROFILE.name[0]}
        </span>
        <div className="leading-tight">
          <h1 className="font-display text-[1.6rem] font-extrabold">{RIYA_PROFILE.name}</h1>
          <p className="text-sm text-muted">
            {profile.diet === "veg" ? "Veg" : "Non-veg"} · Budget {formatRupees(profile.budget)}
          </p>
        </div>
      </header>

      <div className="flex items-center justify-between rounded-2xl bg-espresso p-4 text-oat">
        <div>
          <span className="mono-label text-matcha">BREW POINTS</span>
          <p className="font-display text-3xl font-extrabold">{profile.brewPoints}</p>
        </div>
        <p className="max-w-[9rem] text-right text-xs text-oat/70">Earn points on every reservation.</p>
      </div>

      <section>
        <MonoLabel>INGREDIENTS YOU LIKE</MonoLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.likedIngredientIds.length === 0 && <p className="text-sm text-muted">Swipe right on a few to fill this up.</p>}
          {profile.likedIngredientIds.map((id) => (
            <span key={id} className="inline-flex items-center gap-1.5 rounded-full bg-espresso px-3 py-1.5 text-sm text-oat">
              <Heart size={12} fill="currentColor" aria-hidden="true" />
              {INGREDIENT_BY_ID[id]?.name ?? id}
            </span>
          ))}
        </div>
      </section>

      <section>
        <MonoLabel>NOT FOR YOU</MonoLabel>
        <div className="mt-2 flex flex-wrap gap-2">
          {profile.dislikedIngredientIds.length === 0 && <p className="text-sm text-muted">Nothing skipped yet.</p>}
          {profile.dislikedIngredientIds.map((id) => (
            <span key={id} className="rounded-full border border-line px-3 py-1.5 text-sm text-muted">
              {INGREDIENT_BY_ID[id]?.name ?? id}
            </span>
          ))}
        </div>
      </section>

      <section>
        <MonoLabel>DIET</MonoLabel>
        <div className="mt-2">
          <span className="inline-flex rounded-full bg-matcha/25 px-3 py-1.5 text-sm font-medium text-forest">
            {profile.diet === "veg" ? "Veg" : "Non-veg"}
          </span>
        </div>
      </section>

      <div className="flex items-center gap-3 rounded-2xl border border-line bg-oat p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-matcha/25 text-forest">
          <MessageCircle size={18} />
        </span>
        <div className="flex-1 leading-tight">
          <p id="wa-label" className="text-sm font-semibold">Second Serve alerts on WhatsApp</p>
          <p className="mt-0.5 text-xs text-muted">Only offers that match your taste and pass safety checks.</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={profile.whatsappOptIn}
          aria-labelledby="wa-label"
          onClick={toggleWhatsapp}
          className={`relative flex h-11 w-[3.25rem] shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest ${
            profile.whatsappOptIn ? "bg-forest" : "bg-line"
          }`}
        >
          <span
            className={`absolute h-7 w-7 rounded-full bg-oat shadow transition-all ${
              profile.whatsappOptIn ? "left-6" : "left-1"
            }`}
          />
          <span className="sr-only">{profile.whatsappOptIn ? "On" : "Off"}</span>
        </button>
      </div>
    </div>
  );
}

"use client";

import { Home, Smartphone, ShoppingBag, Tag, User } from "lucide-react";
import type { Tab } from "./shared";

const TABS: { id: Tab; label: string; Icon: typeof Home }[] = [
  { id: "home", label: "Home", Icon: Home },
  { id: "taste", label: "Taste", Icon: Smartphone },
  { id: "order", label: "Order", Icon: ShoppingBag },
  { id: "offers", label: "Offers", Icon: Tag },
  { id: "profile", label: "Profile", Icon: User },
];

interface BottomNavProps {
  active: Tab;
  onChange: (tab: Tab) => void;
  dark?: boolean;
  offerDot?: boolean;
}

export function BottomNav({ active, onChange, dark = false, offerDot = false }: BottomNavProps) {
  return (
    <nav
      aria-label="Main"
      className={`grid shrink-0 grid-cols-5 border-t px-2 pb-5 pt-2.5 transition-colors ${
        dark ? "border-oat/10 bg-espresso" : "border-line bg-oat"
      }`}
    >
      {TABS.map(({ id, label, Icon }) => {
        const isActive = id === active;
        const color = isActive
          ? dark
            ? "text-matcha font-semibold"
            : "text-espresso font-semibold"
          : dark
            ? "text-oat/60"
            : "text-muted";
        return (
          <button
            key={id}
            type="button"
            onClick={() => onChange(id)}
            aria-current={isActive ? "page" : undefined}
            className={`relative flex flex-col items-center gap-1 rounded-xl py-1 text-[11px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha ${color}`}
          >
            <Icon size={20} strokeWidth={isActive ? 2.2 : 1.7} aria-hidden="true" />
            {label}
            {id === "offers" && offerDot && !isActive && (
              <span className="absolute right-[30%] top-0.5 h-2 w-2 rounded-full bg-crema ring-2 ring-oat">
                <span className="sr-only">New offer</span>
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

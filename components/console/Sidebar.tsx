"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutGrid,
  Thermometer,
  Tag,
  TrendingUp,
  QrCode,
  Users,
  ScrollText,
  Menu,
  X,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export type ConsoleTab =
  | "today"
  | "batches"
  | "offers"
  | "forecast"
  | "menu"
  | "customers"
  | "audit";

const NAV_ITEMS: Array<{ id: ConsoleTab; label: string; icon: typeof LayoutGrid }> = [
  { id: "today", label: "Today", icon: LayoutGrid },
  { id: "batches", label: "Batches & sensors", icon: Thermometer },
  { id: "offers", label: "Second Serve offers", icon: Tag },
  { id: "forecast", label: "Demand forecast", icon: TrendingUp },
  { id: "menu", label: "Menu & QR", icon: QrCode },
  { id: "customers", label: "Customers & loyalty", icon: Users },
  { id: "audit", label: "Audit log", icon: ScrollText },
];

const NOTE = (
  <div className="rounded-xl border border-oat/10 bg-oat/5 p-4 text-xs leading-relaxed text-oat/60">
    Decision-support only. Sensor readings indicate monitored conditions; they do not prove food
    is safe. Staff confirm every action.
  </div>
);

interface SidebarProps {
  active: ConsoleTab;
  onSelect: (tab: ConsoleTab) => void;
}

/**
 * `rail` renders the icon-only collapsed form (1024–1279px) that expands to
 * full labelled items at 1280px (xl) via CSS alone — no JS breakpoint
 * detection, so no hydration risk. The drawer/mobile copy always passes
 * rail=false (always-labelled).
 */
function NavList({ active, onSelect, rail }: SidebarProps & { rail: boolean }) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onSelect(id)}
            aria-label={label}
            className={`flex min-h-11 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors
              focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matcha
              ${rail ? "justify-center xl:justify-start" : ""}
              ${isActive ? "bg-forest text-oat" : "text-oat/65 hover:bg-oat/5 hover:text-oat"}`}
          >
            <Icon size={18} strokeWidth={2.25} aria-hidden="true" className="shrink-0" />
            <span className={rail ? "hidden xl:inline" : undefined}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const select = (tab: ConsoleTab) => {
    onSelect(tab);
    setDrawerOpen(false);
  };

  return (
    <>
      {/* Mobile/tablet top bar — below the lg breakpoint (1024px) */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-line bg-espresso px-4 lg:hidden">
        <Logo consoleVariant size={26} />
        <button
          type="button"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
          className="flex h-11 w-11 items-center justify-center rounded-xl text-oat hover:bg-oat/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha"
        >
          <Menu size={20} aria-hidden="true" />
        </button>
      </div>

      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-espresso/40 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.aside
              key="drawer"
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col justify-between bg-espresso p-5 text-oat lg:hidden"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ duration: 0.25, ease: "easeOut" }}
            >
              <div className="flex flex-col gap-8">
                <div className="flex items-center justify-between px-1">
                  <Logo consoleVariant size={30} />
                  <button
                    type="button"
                    aria-label="Close menu"
                    onClick={() => setDrawerOpen(false)}
                    className="flex h-11 w-11 items-center justify-center rounded-xl text-oat hover:bg-oat/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-matcha"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                </div>
                <NavList active={active} onSelect={select} rail={false} />
              </div>
              {NOTE}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Persistent rail/sidebar — lg (1024px) and up. Icon-only rail from
          1024–1279px, full labelled sidebar from 1280px (xl) up — unchanged
          from the original design at that size. */}
      <aside className="hidden h-full shrink-0 flex-col justify-between bg-espresso p-5 text-oat lg:flex lg:w-20 xl:w-64 xl:p-5">
        <div className="flex flex-col gap-8">
          <div className="px-1">
            <Logo consoleVariant size={32} hideWordmarkBelowXl />
          </div>
          <NavList active={active} onSelect={onSelect} rail />
        </div>

        <div className="hidden xl:block">{NOTE}</div>
      </aside>
    </>
  );
}

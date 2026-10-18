"use client";

import {
  LayoutGrid,
  Thermometer,
  Tag,
  TrendingUp,
  QrCode,
  Users,
  ScrollText,
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

interface SidebarProps {
  active: ConsoleTab;
  onSelect: (tab: ConsoleTab) => void;
}

export function Sidebar({ active, onSelect }: SidebarProps) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col justify-between bg-espresso p-5 text-oat">
      <div className="flex flex-col gap-8">
        <div className="px-1">
          <Logo consoleVariant size={32} />
        </div>
        <nav className="flex flex-col gap-1">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const isActive = active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onSelect(id)}
                className={`flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-sm font-medium transition-colors
                  focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matcha
                  ${isActive ? "bg-forest text-oat" : "text-oat/65 hover:bg-oat/5 hover:text-oat"}`}
              >
                <Icon size={16} strokeWidth={2.25} aria-hidden="true" />
                {label}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="rounded-xl border border-oat/10 bg-oat/5 p-4 text-xs leading-relaxed text-oat/60">
        Decision-support only. Sensor readings indicate monitored conditions; they do not
        prove food is safe. Staff confirm every action.
      </div>
    </aside>
  );
}

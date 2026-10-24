"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Building2, ClipboardList, LayoutGrid, MessagesSquare, MoreHorizontal, PackageCheck, Plug, TrendingUp,
  UserRoundCheck, Users, Wallet,
} from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/shadcn/sheet";
import type { NavGroup, NavItem } from "@/features/navigation";
import { cn } from "@/lib/utils";

const ICONS: Record<NavItem["icon"], typeof LayoutGrid> = {
  today: LayoutGrid,
  supply: TrendingUp,
  orders: ClipboardList,
  batches: PackageCheck,
  payments: Wallet,
  assistant: MessagesSquare,
  farmers: Users,
  fpo: Building2,
  agents: UserRoundCheck,
  settings: Plug,
};

function isActive(pathname: string, item: NavItem) {
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

function NavLinks({ nav, onNavigate }: { nav: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-col gap-6" aria-label="Main">
      {nav.map((group) => (
        <div key={group.label} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1 text-xs text-oat/45">{group.label}</p>
          {group.items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = isActive(pathname, item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors duration-150",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-matcha",
                  active ? "bg-forest text-oat" : "text-oat/70 hover:bg-oat/5 hover:text-oat"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function ShellNav({ nav }: { nav: NavGroup[] }) {
  return (
    <aside className="sticky top-0 hidden h-screen-safe w-60 shrink-0 flex-col justify-between overflow-y-auto bg-espresso px-3 py-5 lg:flex">
      <div className="flex flex-col gap-8">
        <Link href="/" className="px-2" aria-label="Coffee on QR home">
          <Logo consoleVariant size={30} />
        </Link>
        <NavLinks nav={nav} />
      </div>
      <p className="px-3 text-xs leading-relaxed text-oat/45">
        Forecasts are estimates. Visual grades are not food-safety certificates. Staff confirm every action.
      </p>
    </aside>
  );
}

/** Mobile: logo in the top bar, a bottom nav with the first four destinations and "More". */
export function MobileNav({ nav }: { nav: NavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = nav.flatMap((g) => g.items);
  const primary = items.slice(0, 4);

  return (
    <>
      <Link href="/" className="lg:hidden" aria-label="Coffee on QR home">
        <Logo size={28} onDark={false} />
      </Link>
      <nav
        aria-label="Main"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 flex border-t border-hairline bg-surface lg:hidden"
      >
        {primary.map((item) => {
          const Icon = ICONS[item.icon];
          const active = isActive(pathname, item);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs",
                active ? "font-medium text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        {items.length > 4 && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs text-muted-foreground"
          >
            <MoreHorizontal className="size-5" aria-hidden="true" />
            More
          </button>
        )}
      </nav>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-72 border-none bg-espresso p-4 text-oat">
          <SheetHeader className="p-0 pb-6">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <Logo consoleVariant size={28} />
          </SheetHeader>
          <NavLinks nav={nav} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
    </>
  );
}

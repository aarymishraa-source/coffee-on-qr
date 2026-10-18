"use client";

import { CustomerApp } from "@/components/customer/CustomerApp";
import { useMounted } from "@/components/customer/shared";

/**
 * Phone frame (~390×844) on desktop, shrunk to fit shorter screens so the
 * page never scrolls (a 900px-tall laptop can't fit 844 + padding). On a real
 * phone the frame disappears and the app fills the screen.
 */
export default function CustomerAppPage() {
  // The store lives in localStorage, so render only after mount to avoid hydration mismatches.
  const mounted = useMounted();
  return (
    <div className="flex h-dvh w-full items-center justify-center overflow-hidden bg-paper">
      <div className="relative h-dvh w-full overflow-hidden bg-paper md:h-[min(844px,calc(100dvh-3rem))] md:w-[390px] md:rounded-[2.75rem] md:border-[6px] md:border-espresso md:shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 z-20 hidden h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-espresso md:block"
        />
        {mounted && <CustomerApp />}
      </div>
    </div>
  );
}

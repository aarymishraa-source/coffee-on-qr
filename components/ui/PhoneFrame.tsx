import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  /** When true, renders only the screen (no outer frame/centring) — for embedding in /demo's own layout. */
  bare?: boolean;
}

/**
 * Centred phone frame (~390×844) on desktop. On a real phone viewport the
 * frame chrome disappears and the screen fills the device — see CLAUDE.md §4.
 */
export function PhoneFrame({ children, bare = false }: PhoneFrameProps) {
  if (bare) {
    return <div className="h-full w-full overflow-y-auto bg-oat">{children}</div>;
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-paper md:py-10">
      <div className="relative h-screen w-full overflow-hidden bg-oat md:h-[844px] md:w-[390px] md:rounded-[2.75rem] md:border-[6px] md:border-espresso md:shadow-2xl">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 z-20 hidden h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-espresso md:block"
        />
        <div className="h-full w-full overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}

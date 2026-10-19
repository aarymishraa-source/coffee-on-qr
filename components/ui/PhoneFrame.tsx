import type { ReactNode } from "react";

interface PhoneFrameProps {
  children: ReactNode;
  /** When true, renders only the screen (no outer frame/centring) — for embedding in /demo's own layout. */
  bare?: boolean;
  /** Keeps the phone frame chrome (border/notch/shadow) but skips the full-viewport centring wrapper — for /demo, which does its own layout. */
  embedded?: boolean;
}

// Below this width the phone frame disappears and the app fills the real
// device screen. At/above it we show a centred frame that fits the window
// (sized via the [data-phone-frame] rule in globals.css).
const FRAME_BREAKPOINT = "min-[600px]:";

/**
 * Centred phone frame (~390×844) on tablet/desktop, scaled down to fit a
 * shorter window. On a real phone viewport (<600px) the frame chrome
 * disappears and the screen fills the device — see CLAUDE.md §4.
 */
export function PhoneFrame({ children, bare = false, embedded = false }: PhoneFrameProps) {
  if (bare) {
    return <div className="h-full w-full overflow-y-auto bg-oat">{children}</div>;
  }

  const frame = (
    <div
      data-phone-frame
      className={`relative h-screen-safe w-full overflow-hidden bg-oat ${FRAME_BREAKPOINT}rounded-[2.75rem] ${FRAME_BREAKPOINT}border-[6px] ${FRAME_BREAKPOINT}border-espresso ${FRAME_BREAKPOINT}shadow-2xl`}
    >
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute left-1/2 top-0 z-20 hidden h-6 w-32 -translate-x-1/2 rounded-b-2xl bg-espresso ${FRAME_BREAKPOINT}block`}
      />
      <div className="h-full w-full overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );

  if (embedded) return frame;

  return (
    <div className={`min-h-screen-safe w-full flex items-center justify-center bg-paper ${FRAME_BREAKPOINT}py-8`}>
      {frame}
    </div>
  );
}

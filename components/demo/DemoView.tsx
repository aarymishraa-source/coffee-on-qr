"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HelpCircle, RotateCcw, Smartphone, LayoutGrid } from "lucide-react";
import { Logo } from "@/components/ui/Logo";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PhoneFrame } from "@/components/ui/PhoneFrame";
import { CustomerApp } from "@/components/customer/CustomerApp";
import { ConsoleView } from "@/components/console/ConsoleView";
import { ScaledPanel } from "@/components/demo/ScaledPanel";
import { useLiveNow, useStore } from "@/lib/store";
import { canApproveOffer, getBatchThermal } from "@/lib/selectors";
import { formatClock } from "@/lib/format";
import { useMediaQuery } from "@/lib/useMediaQuery";

const CONSOLE_DESIGN_WIDTH = 1280;
const CONSOLE_DESIGN_HEIGHT = 1320;

type PulseDirection = "toPhone" | "toConsole";
type MobileSide = "app" | "console";

function isTypingTarget(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA" || el.isContentEditable;
}

export function DemoView() {
  const now = useLiveNow();
  const [resetKey, setResetKey] = useState(0);
  const [pulse, setPulse] = useState<{ id: number; direction: PulseDirection } | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [mobileSide, setMobileSide] = useState<MobileSide>("app");
  const pulseCounter = useRef(0);

  // ≥1280px: the full scaled side-by-side recording layout (unchanged from
  // before). Below that there isn't room for both at a usable size, so we
  // show one side at a time via a toggle instead.
  const isSplitView = useMediaQuery("(min-width: 1280px)");

  const triggerPulse = useCallback((direction: PulseDirection) => {
    pulseCounter.current += 1;
    setPulse({ id: pulseCounter.current, direction });
    window.setTimeout(() => setPulse((p) => (p?.id === pulseCounter.current ? null : p)), 900);
  }, []);

  // Watch for the two cross-over moments the demo script cares about:
  // an offer getting approved (console → phone) and a Second Serve
  // reservation landing (phone → console).
  useEffect(() => {
    return useStore.subscribe((state, prev) => {
      const justApproved = state.offers.some(
        (o) => o.status === "approved" && prev.offers.find((p) => p.id === o.id)?.status !== "approved"
      );
      if (justApproved) {
        triggerPulse("toPhone");
        return;
      }
      if (state.reservations.length > prev.reservations.length) {
        const newest = state.reservations[state.reservations.length - 1];
        if (newest?.secondServe) triggerPulse("toConsole");
      }
    });
  }, [triggerPulse]);

  const handleReset = useCallback(() => {
    useStore.getState().resetDemo();
    setResetKey((k) => k + 1);
  }, []);

  const handleFastForward = useCallback(() => {
    useStore.getState().fastForward30();
  }, []);

  const handleApprove = useCallback(() => {
    const { offers, batches, approveOffer } = useStore.getState();
    const target = offers.find((o) => {
      if (o.status !== "pending") return false;
      const batch = batches[o.batchId];
      return Boolean(batch) && canApproveOffer(getBatchThermal(batch, useStore.getState().now()).status);
    });
    if (target) approveOffer(target.id);
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;
      if (e.key === "r" || e.key === "R") handleReset();
      else if (e.key === "f" || e.key === "F") handleFastForward();
      else if (e.key === "a" || e.key === "A") handleApprove();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleReset, handleFastForward, handleApprove]);

  return (
    <div className="relative flex h-screen-safe w-screen flex-col overflow-hidden bg-paper">
      {/* Top bar */}
      <div className="flex h-16 shrink-0 flex-wrap items-center justify-between gap-2 border-b border-line px-4 sm:px-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <Logo size={28} onDark={false} withWordmark={isSplitView} />
          <span className="mono-label hidden text-muted sm:inline">Live demo · demo data</span>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="hidden font-mono text-sm text-muted sm:inline">{formatClock(now)}</span>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw size={14} aria-hidden="true" />
            <span className="hidden sm:inline">Reset demo</span>
          </Button>
          <div className="relative">
            <button
              type="button"
              aria-label="Keyboard shortcuts"
              onClick={() => setShowLegend((v) => !v)}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-line text-muted transition-colors hover:bg-paper focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-forest max-xl:h-11 max-xl:w-11"
            >
              <HelpCircle size={15} aria-hidden="true" />
            </button>
            <AnimatePresence>
              {showLegend && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="absolute right-0 top-10 z-50 w-56 rounded-xl border border-line bg-oat p-3.5 text-sm shadow-xl"
                >
                  <p className="mono-label mb-2 text-muted">Keyboard shortcuts</p>
                  <ul className="flex flex-col gap-1.5">
                    <li className="flex items-center justify-between">
                      <span>Reset demo</span>
                      <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-xs">R</kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Fast-forward 30 min</span>
                      <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-xs">F</kbd>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>Approve pending offer</span>
                      <kbd className="rounded border border-line bg-paper px-1.5 py-0.5 font-mono text-xs">A</kbd>
                    </li>
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Below 1280px: a toggle between the two sides, one shown at a time. */}
      {!isSplitView && (
        <div className="flex shrink-0 flex-col gap-2 border-b border-line bg-oat px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-2">
            <Chip
              touchSize="always"
              active={mobileSide === "app"}
              onClick={() => setMobileSide("app")}
              icon={<Smartphone size={14} aria-hidden="true" />}
            >
              Customer app
            </Chip>
            <Chip
              touchSize="always"
              active={mobileSide === "console"}
              onClick={() => setMobileSide("console")}
              icon={<LayoutGrid size={14} aria-hidden="true" />}
            >
              Café console
            </Chip>
          </div>
          <p className="text-xs text-muted">Best viewed on a laptop for the full split-screen demo.</p>
        </div>
      )}

      {/* Phone + console — both stay mounted at all times (even when hidden
          by the toggle below 1280px) so the store, the WhatsApp banner and
          the cross-over pulse all keep working regardless of which side is
          visible. */}
      <div className="relative flex min-h-0 flex-1">
        <div
          className={
            isSplitView
              ? "flex w-[34%] shrink-0 items-center justify-center py-6"
              : mobileSide === "app"
                ? "flex min-h-0 flex-1 justify-center overflow-hidden"
                : "hidden"
          }
        >
          {isSplitView ? (
            <PhoneFrame embedded key={`phone-${resetKey}`}>
              <CustomerApp />
            </PhoneFrame>
          ) : (
            // Below 1280px there isn't a reliable way to size the frame's
            // chrome against the remaining space after this page's own top
            // bars (dvh-based sizing doesn't know about sibling heights), so
            // the toggle view skips the bezel and just fills the available
            // area — same treatment /app itself uses under 600px.
            <div className="h-full w-full max-w-md" key={`phone-mobile-${resetKey}`}>
              <PhoneFrame bare>
                <CustomerApp />
              </PhoneFrame>
            </div>
          )}
        </div>

        <div
          className={
            isSplitView
              ? "flex w-[66%] min-h-0 flex-1 py-4 pr-4"
              : mobileSide === "console"
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "hidden"
          }
        >
          {isSplitView ? (
            <ScaledPanel designWidth={CONSOLE_DESIGN_WIDTH} designHeight={CONSOLE_DESIGN_HEIGHT}>
              <div className="h-full w-full overflow-hidden rounded-3xl border border-line shadow-xl" key={`console-${resetKey}`}>
                <ConsoleView embedded />
              </div>
            </ScaledPanel>
          ) : (
            <div className="min-h-0 flex-1 overflow-hidden" key={`console-mobile-${resetKey}`}>
              <ConsoleView embedded />
            </div>
          )}
        </div>

        {/* Pulse — flashes across the boundary between phone and console on an approval or reservation */}
        <AnimatePresence>
          {pulse && isSplitView && (
            <motion.div
              key={pulse.id}
              className="pointer-events-none absolute inset-y-0 z-40 w-1.5 bg-gradient-to-b from-transparent via-matcha to-transparent"
              style={{ left: "34%" }}
              initial={{ opacity: 0, scaleY: 0.2 }}
              animate={{ opacity: [0, 1, 1, 0], scaleY: [0.2, 1, 1, 0.3] }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

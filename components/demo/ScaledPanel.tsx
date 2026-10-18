"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

interface ScaledPanelProps {
  children: ReactNode;
  /** Natural (unscaled) size of the content, in px. */
  designWidth: number;
  designHeight: number;
}

/**
 * Renders `children` at their natural size, then scales the whole block
 * down (uniformly, never up) to fit whatever box this panel is given —
 * so /demo can drop the full console in at ~66% width without its own
 * scrollbars. Re-measures on resize.
 */
export function ScaledPanel({ children, designWidth, designHeight }: ScaledPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const next = Math.min(1, width / designWidth, height / designHeight);
      setScale(next > 0 ? next : 1);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [designWidth, designHeight]);

  return (
    <div ref={containerRef} className="flex h-full w-full items-center justify-center overflow-hidden">
      <div
        style={{
          width: designWidth,
          height: designHeight,
          transform: `scale(${scale})`,
          transformOrigin: "center center",
        }}
        className="shrink-0"
      >
        {children}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { animate, useMotionValue, useTransform } from "framer-motion";

interface AnimatedNumberProps {
  value: number;
  format?: (n: number) => string;
  className?: string;
}

/** Ticks a number up/down smoothly whenever `value` changes — used for KPI cards. */
export function AnimatedNumber({ value, format, className }: AnimatedNumberProps) {
  const motionValue = useMotionValue(value);
  const display = useTransform(motionValue, (v) =>
    format ? format(v) : Math.round(v).toLocaleString("en-IN")
  );
  const spanRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const controls = animate(motionValue, value, { duration: 0.6, ease: "easeOut" });
    return controls.stop;
  }, [value, motionValue]);

  useEffect(() => {
    const unsubscribe = display.on("change", (v) => {
      if (spanRef.current) spanRef.current.textContent = v;
    });
    return unsubscribe;
  }, [display]);

  return (
    <span ref={spanRef} className={className}>
      {format ? format(value) : value}
    </span>
  );
}

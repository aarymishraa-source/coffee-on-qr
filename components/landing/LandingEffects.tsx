"use client";

import { useEffect } from "react";
import { initLanding } from "./landing-effects";

/** Runs the reference page's scripts (scroll, reveals, demos) and tears them down on unmount. */
export function LandingEffects() {
  useEffect(() => {
    const root = document.getElementById("lp");
    if (!root) return;
    return initLanding(root);
  }, []);
  return null;
}

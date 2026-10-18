"use client";

import { useEffect } from "react";
import { initHero3D } from "./hero-scene";

/** Builds the 3D cup into #stage. The scene creates (and removes) its own canvas on each mount. */
export default function Hero3D() {
  useEffect(() => {
    const stage = document.getElementById("stage");
    if (!stage) return;
    return initHero3D(stage);
  }, []);
  return null;
}

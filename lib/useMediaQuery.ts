"use client";

import { useEffect, useState } from "react";

/**
 * Only safe to use in components that never render during SSR (dynamic
 * import with ssr:false, or a client-only subtree) — otherwise the server
 * render and the client's first render would disagree and React would warn.
 * Every caller in this app lives inside /console, /app or /demo, all of
 * which are already client-only for exactly this reason.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

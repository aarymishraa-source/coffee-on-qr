"use client";

import dynamic from "next/dynamic";

// The console depends on the demo clock (Date.now()) and localStorage-backed
// store state, both of which only exist on the client — rendering it only
// there avoids any server/client hydration mismatch.
const ConsoleView = dynamic(
  () => import("@/components/console/ConsoleView").then((m) => m.ConsoleView),
  {
    ssr: false,
    loading: () => <div className="min-h-screen bg-paper" />,
  }
);

export default function ConsolePage() {
  return <ConsoleView />;
}

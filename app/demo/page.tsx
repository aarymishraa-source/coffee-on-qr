"use client";

import dynamic from "next/dynamic";

// Same reasoning as /console — the demo clock and localStorage-backed store
// only exist on the client, so render this only there.
const DemoView = dynamic(() => import("@/components/demo/DemoView").then((m) => m.DemoView), {
  ssr: false,
  loading: () => <div className="h-screen w-screen bg-paper" />,
});

export default function DemoPage() {
  return <DemoView />;
}

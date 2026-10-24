import { Suspense } from "react";
import { requirePage } from "@/server/auth/guard";
import { KisanChat } from "@/features/assistant/components/KisanChat";

export const metadata = { title: "Kisan Sahayak — Coffee on QR" };

async function Chat() {
  const actor = await requirePage("/kisan");
  return <KisanChat role={actor.role as "ADMIN" | "FPO_MANAGER" | "FIELD_AGENT" | "FARMER"} userName={actor.name} />;
}

export default function KisanPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100dvh-3.5rem)] animate-pulse bg-chat-wallpaper" />}>
      <Chat />
    </Suspense>
  );
}

import { Suspense } from "react";
import Link from "next/link";
import { Logo } from "@/components/ui/Logo";
import { ROLE_LABEL } from "@/server/auth/types";
import { DEMO_USERS, DEMO_PASSWORD } from "@/server/demo/seed-data";
import { LoginForm } from "@/features/auth/LoginForm";

export const metadata = { title: "Sign in — Coffee on QR" };

const DESCRIPTIONS: Record<string, string> = {
  "user-cafe": "Supply forecast, offers, payments",
  "user-fpo": "Farmers, commitments, order progress",
  "user-kavita": "Assigned farmers and their chats",
  "user-anil": "Assigned farmers and their chats",
  "user-ramesh": "Own chat, orders and payments (Marathi)",
  "user-sunita": "Own chat, orders and payments (Hindi)",
  "user-admin": "Everything, including integrations",
};

export default function LoginPage() {
  const accounts = DEMO_USERS.map((u) => ({
    email: u.email,
    name: u.name,
    role: ROLE_LABEL[u.role],
    description: DESCRIPTIONS[u.id] ?? "",
  }));
  return (
    <div className="flex min-h-screen-safe flex-col bg-background lg:flex-row">
      <aside className="flex flex-col justify-between gap-10 bg-espresso px-6 py-8 text-oat lg:w-[420px] lg:px-10 lg:py-12">
        <Link href="/" aria-label="Coffee on QR home">
          <Logo consoleVariant size={34} />
        </Link>
        <div className="space-y-3">
          <h1 className="font-display text-[28px] font-bold leading-tight lg:text-[40px]">
            Café demand, straight to the farm.
          </h1>
          <p className="text-sm leading-relaxed text-oat/70">
            Kisan Sahayak turns your café&apos;s sales into ingredient orders for farmer groups — and gives farmers an
            assistant in their own language.
          </p>
        </div>
        <p className="hidden text-xs text-oat/45 lg:block">Demo environment · seeded records only</p>
      </aside>
      <main className="flex flex-1 items-start justify-center px-4 py-8 md:px-8 lg:items-center">
        <Suspense fallback={<div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-sunken" />}>
          <LoginForm accounts={accounts} demoPassword={DEMO_PASSWORD} />
        </Suspense>
      </main>
    </div>
  );
}

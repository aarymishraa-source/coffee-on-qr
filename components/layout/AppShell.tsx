import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getActor } from "@/server/auth/session";
import { getDb } from "@/lib/db";
import { navFor } from "@/features/navigation";
import { ROLE_LABEL } from "@/server/auth/types";
import { ShellNav, MobileNav } from "./ShellNav";
import { DemoMenu } from "./DemoMenu";
import { Providers } from "./Providers";

// Server shell shared by the supply console and the Kisan module.
export async function AppShell({ children }: { children: ReactNode }) {
  const actor = await getActor();
  if (!actor) redirect("/login");
  const nav = navFor(actor.role);
  const db = await getDb();
  const demoAccounts = actor.isDemo
    ? (await db.user.findMany({ where: { isDemo: true }, orderBy: { createdAt: "asc" } })).map((u) => ({
        id: u.id,
        name: u.name,
        role: ROLE_LABEL[u.role],
      }))
    : [];

  const user = { id: actor.id ?? "", name: actor.name, role: ROLE_LABEL[actor.role], isDemo: actor.isDemo };

  return (
    <Providers>
      <div className="flex min-h-screen-safe bg-background text-foreground">
        <ShellNav nav={nav} />
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-hairline bg-background/95 px-4 backdrop-blur md:px-8">
            <MobileNav nav={nav} />
            <div className="hidden items-center gap-2 text-sm text-muted-foreground lg:flex">
              <span className="inline-flex items-center rounded-full border border-dashed border-hairline px-2.5 py-0.5 text-xs">
                Demo data
              </span>
              <span>Estimates and records here are seeded for the demo.</span>
            </div>
            <DemoMenu user={user} demoAccounts={demoAccounts} />
          </header>
          <main className="flex-1 pb-24 lg:pb-0">{children}</main>
        </div>
      </div>
    </Providers>
  );
}

export function ShellFallback() {
  return (
    <div className="flex min-h-screen-safe bg-background">
      <div className="hidden w-60 shrink-0 bg-espresso lg:block" />
      <div className="flex-1">
        <div className="h-14 border-b border-hairline" />
        <div className="mx-auto max-w-[1200px] space-y-4 p-4 md:p-8">
          <div className="h-8 w-64 animate-pulse rounded-lg bg-sunken" />
          <div className="h-64 animate-pulse rounded-xl bg-sunken" />
        </div>
      </div>
    </div>
  );
}

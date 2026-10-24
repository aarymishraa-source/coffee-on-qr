import { Suspense } from "react";
import { AppShell, ShellFallback } from "@/components/layout/AppShell";

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<ShellFallback />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}

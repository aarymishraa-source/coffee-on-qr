import Link from "next/link";
import { Button } from "@/components/shadcn/button";

export const metadata = { title: "No access — Coffee on QR" };

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen-safe flex-col items-center justify-center gap-3 bg-background px-4 text-center">
      <h1 className="font-display text-[28px] font-bold">This page isn&apos;t for your role</h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Your account can&apos;t open that page. Sign in with a different account, or go back to your home screen.
      </p>
      <div className="flex gap-2 pt-2">
        <Button asChild>
          <Link href="/login">Switch account</Link>
        </Button>
        <Button asChild variant="ghost">
          <Link href="/">Home</Link>
        </Button>
      </div>
    </main>
  );
}

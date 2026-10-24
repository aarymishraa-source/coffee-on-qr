"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, RotateCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";
import { Button } from "@/components/shadcn/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { apiSend } from "@/lib/fetcher";

interface Props {
  user: { id: string; name: string; role: string; isDemo: boolean };
  demoAccounts: { id: string; name: string; role: string }[];
}

export function DemoMenu({ user, demoAccounts }: Props) {
  const router = useRouter();
  const [confirmReset, setConfirmReset] = useState(false);

  async function switchTo(id: string) {
    try {
      const r = await apiSend<{ home: string; name: string }>("/api/auth/switch", { userId: id });
      toast.success(`Switched to ${r.name}`);
      router.push(r.home);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function signOut() {
    await apiSend("/api/auth/logout");
    router.push("/login");
    router.refresh();
  }

  async function reset() {
    await apiSend("/api/demo/reset");
    toast.success("Demo data reset");
    router.refresh();
    window.dispatchEvent(new Event("cqr:demo-reset"));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="ml-auto h-9 gap-2 px-2">
            <span className="flex size-7 items-center justify-center rounded-full bg-primary-soft text-xs font-medium text-primary">
              {user.name.split(" ").map((p) => p[0]).join("").slice(0, 2)}
            </span>
            <span className="hidden text-left text-sm leading-tight sm:block">
              <span className="block font-medium">{user.name}</span>
              <span className="block text-xs text-muted-foreground">{user.role}</span>
            </span>
            <ChevronDown className="size-4 text-muted-foreground" aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {user.isDemo && demoAccounts.length > 0 && (
            <>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">Present as (demo accounts)</DropdownMenuLabel>
              {demoAccounts.map((a) => (
                <DropdownMenuItem key={a.id} disabled={a.id === user.id} onSelect={() => switchTo(a.id)}>
                  <UserRound className="size-4" aria-hidden="true" />
                  <span className="flex-1">{a.name}</span>
                  <span className="text-xs text-muted-foreground">{a.role}</span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setConfirmReset(true)}>
                <RotateCcw className="size-4" aria-hidden="true" />
                Reset demo data
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuItem onSelect={signOut}>
            <LogOut className="size-4" aria-hidden="true" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={confirmReset}
        onOpenChange={setConfirmReset}
        title="Reset demo data?"
        description="This restores the seeded demo records — offers, commitments, chats, batches and payments made during the demo are removed. Records that aren't demo data are never touched."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={reset}
      />
    </>
  );
}

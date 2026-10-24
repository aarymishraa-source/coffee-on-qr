"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { ConfirmDialog } from "@/components/feedback/ConfirmDialog";
import { apiSend } from "@/lib/fetcher";

export function ResetDemoButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        Reset demo data
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Reset demo data?"
        description="Offers, commitments, chats, batches and payments made during the demo are removed and the seeded records restored. Non-demo records are never touched."
        confirmLabel="Reset demo data"
        destructive
        onConfirm={async () => {
          try {
            await apiSend("/api/demo/reset");
            toast.success("Demo data reset");
            router.refresh();
          } catch (e) {
            toast.error((e as Error).message);
          }
        }}
      />
    </>
  );
}

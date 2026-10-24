"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";
import { Label } from "@/components/shadcn/label";
import { apiSend } from "@/lib/fetcher";

interface Props {
  offerId: string;
  farmerId: string;
  ingredient: string;
  committed: number;
}

/** Log a harvest batch against a commitment, with an optional harvest photo for the preliminary grade. */
export function LogHarvestButton({ offerId, farmerId, ingredient, committed }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(String(committed));
  const [date, setDate] = useState(() => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }));
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function useSample() {
    const blob = await (await fetch("/demo/basil-harvest.jpg")).blob();
    setFile(new File([blob], "basil-harvest.jpg", { type: "image/jpeg" }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = Number(quantity);
    if (!(q > 0) || q > committed) return setError(`Enter between 0 and ${committed} kg.`);
    setBusy(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("offerId", offerId);
      fd.set("farmerId", farmerId);
      fd.set("quantity", String(q));
      fd.set("harvestDate", date);
      if (file) fd.set("file", file);
      const r = await apiSend<{ code: string; prelimGrade: string; gradeSource: string }>("/api/batches", fd);
      toast.success(`Harvest logged as ${r.code}`, {
        description: `Preliminary grade ${r.prelimGrade}${r.gradeSource === "demo" ? " (demo grade)" : ""} — staff confirm at pickup`,
      });
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["conversation", farmerId] });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" className="mt-1" onClick={() => setOpen(true)}>
        Log harvest
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={submit} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>Log {ingredient.toLowerCase()} harvest</DialogTitle>
              <DialogDescription>
                A photo gives a preliminary visual grade. It is not a food-safety certificate — staff confirm the grade at pickup.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="h-qty">Quantity (kg)</Label>
                <Input id="h-qty" inputMode="decimal" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="h-date">Harvest date</Label>
                <Input id="h-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="h-photo">Harvest photo (optional)</Label>
              <Input id="h-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button type="button" className="text-xs text-primary underline-offset-4 hover:underline" onClick={useSample}>
                Use sample harvest photo (demo)
              </button>
              {file && <p className="text-xs text-muted-foreground">Attached: {file.name}</p>}
            </div>
            {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
                Not now
              </Button>
              <Button type="submit" disabled={busy}>
                {busy ? "Logging…" : "Log harvest"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

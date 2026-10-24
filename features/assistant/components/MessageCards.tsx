"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { CheckCircle2, ShieldAlert, Stethoscope } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { apiSend, newKey } from "@/lib/fetcher";
import { qty, rupees, shortDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { QUICK_REPLY, type CropResult, type FarmerOffer, type Lang } from "../types";

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** Order offer inside a bubble. Live numbers come from the stored offer, not the message. */
export function OfferCard({ offer, farmerId, lang, canAnswer }: { offer: FarmerOffer | undefined; farmerId: string; lang: Lang; canAnswer: boolean }) {
  const qc = useQueryClient();
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  if (!offer) {
    return <p className="text-sm text-muted-foreground">This order is closed.</p>;
  }

  async function respond(action: "accept" | "commit" | "decline", quantity?: number) {
    setBusy(true);
    const replyText =
      action === "decline" ? QUICK_REPLY[lang].decline : QUICK_REPLY[lang].commit(fmt(action === "accept" ? offer!.open : quantity!));
    try {
      const r = await apiSend<{ outcome: { kind: string; open?: number } }>(`/api/demand-offers/${offer!.id}/respond`, {
        farmerId,
        action,
        quantity,
        source: "CHAT",
        idempotencyKey: newKey("offer"),
        replyText,
      });
      if (r.outcome.kind === "exceeds") toast.error(`Only ${qty(r.outcome.open ?? 0)} is still needed`);
      else if (r.outcome.kind === "committed") toast.success("Commitment saved");
      else if (r.outcome.kind === "declined") toast.success("Answer saved");
      setCustom(false);
      setAmount("");
      await qc.invalidateQueries({ queryKey: ["conversation", farmerId] });
      qc.invalidateQueries({ queryKey: ["conversations"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const committed = offer.mine?.status === "COMMITTED" ? offer.mine.quantity : 0;
  const n = Number(amount);
  const valid = amount !== "" && n > 0 && n <= offer.open + committed;

  return (
    <div className="w-72 max-w-full space-y-3">
      <div>
        <p className="text-xs text-muted-foreground">New café order</p>
        <p className="text-base font-semibold">
          {offer.ingredient} · {qty(offer.quantity)}
        </p>
        <p className="text-xs text-muted-foreground">
          {rupees(offer.pricePerKg)}/kg · needed by {shortDate(offer.neededBy)}
        </p>
      </div>
      <p className={cn("text-sm", offer.open > 0 ? "text-warning" : "text-success")}>
        {offer.open > 0 ? `${qty(offer.open)} still needed` : "Fully committed"}
        {committed > 0 && <span className="text-muted-foreground"> · you: {qty(committed)}</span>}
      </p>
      {canAnswer && offer.open + committed > 0 && (
        <>
          {!custom ? (
            <div className="flex gap-2">
              {offer.open > 0 && (
                <Button size="sm" disabled={busy} onClick={() => respond("accept")}>
                  Supply {qty(offer.open)}
                </Button>
              )}
              <Button size="sm" variant="outline" disabled={busy} onClick={() => setCustom(true)}>
                {committed > 0 ? "Change amount" : "Other amount"}
              </Button>
            </div>
          ) : (
            <form
              className="space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (valid) respond("commit", n);
              }}
            >
              <div className="flex gap-2">
                <Input
                  autoFocus
                  inputMode="decimal"
                  aria-label="Kilograms you can supply"
                  placeholder={`Up to ${fmt(offer.open + committed)} kg`}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                  className="h-8"
                />
                <Button size="sm" type="submit" disabled={!valid || busy}>
                  Save
                </Button>
              </div>
              <button type="button" className="text-xs text-muted-foreground underline-offset-2 hover:underline" disabled={busy} onClick={() => respond("decline")}>
                Can&apos;t supply this time
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}

const CONF: Record<string, string> = { low: "bg-sunken text-muted-foreground", medium: "bg-warning-soft text-warning", high: "bg-danger-soft text-danger" };

export function CropResultCard({
  result,
  isDemo,
  analysisId,
  expertRequestedAt,
  farmerId,
  onFollowUp,
}: {
  result: CropResult;
  isDemo: boolean;
  analysisId: string;
  expertRequestedAt: string | null;
  farmerId: string;
  onFollowUp: () => void;
}) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!result.image_usable) {
    return (
      <div className="w-72 max-w-full space-y-1">
        <p className="text-sm font-medium">Photo too unclear to check</p>
        <p className="text-sm">{result.info_needed[0] ?? result.limitations}</p>
      </div>
    );
  }

  async function askExpert() {
    setBusy(true);
    try {
      await apiSend(`/api/crop-analysis/${analysisId}/expert`);
      toast.success("Expert review requested");
      qc.invalidateQueries({ queryKey: ["conversation", farmerId] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-80 max-w-full space-y-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Photo check</p>
          <p className="font-semibold">{result.crop ?? "Crop not identified"}</p>
        </div>
        {isDemo && (
          <span className="shrink-0 rounded-full border border-dashed border-hairline px-2 py-0.5 text-xs text-muted-foreground">Demo analysis</span>
        )}
      </div>
      {result.symptoms_observed.length > 0 && (
        <Section title="What's visible">
          <ul className="list-disc space-y-0.5 pl-4">{result.symptoms_observed.map((s) => <li key={s}>{s}</li>)}</ul>
        </Section>
      )}
      {result.possible_causes.length > 0 && (
        <Section title="Possible causes (not a diagnosis)">
          <ul className="space-y-1.5">
            {result.possible_causes.map((c) => (
              <li key={c.name}>
                <span className="flex items-center gap-2">
                  <span className="font-medium">{c.name}</span>
                  <span className={cn("rounded-full px-1.5 py-px text-xs", CONF[c.confidence])}>{c.confidence}</span>
                </span>
                <span className="text-xs text-muted-foreground">{c.evidence}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
      {result.first_steps.length > 0 && (
        <Section title="Safe first steps">
          <ul className="space-y-0.5">
            {result.first_steps.map((s) => (
              <li key={s} className="flex gap-1.5">
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" aria-hidden="true" />
                {s}
              </li>
            ))}
          </ul>
        </Section>
      )}
      {result.info_needed.length > 0 && (
        <Section title="Would help to know">
          <p className="text-muted-foreground">{result.info_needed.join(" · ")}</p>
        </Section>
      )}
      <p className="flex gap-1.5 text-xs text-muted-foreground">
        <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        {result.limitations}
      </p>
      <div className="flex gap-2">
        {expertRequestedAt ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-success">
            <Stethoscope className="size-3.5" aria-hidden="true" /> Expert review requested
          </span>
        ) : (
          <Button size="sm" variant={result.expert_review_recommended ? "default" : "outline"} disabled={busy} onClick={askExpert}>
            <Stethoscope aria-hidden="true" /> Ask an expert
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={onFollowUp}>
          Ask a follow-up
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

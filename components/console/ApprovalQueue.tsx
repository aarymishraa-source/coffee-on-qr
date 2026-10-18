"use client";

import { useState } from "react";
import { Check, ShieldAlert, Users2, PackageSearch } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { formatClock, formatRupees } from "@/lib/format";
import { canApproveOffer, getBatchThermal, isOfferWithdrawn, offerPrice } from "@/lib/selectors";
import { useStore, type Offer } from "@/lib/store";
import { DISH_BY_ID } from "@/lib/seed";

const DISCOUNT_OPTIONS = [20, 30, 40];

function OfferCard({ offer, now }: { offer: Offer; now: Date }) {
  const batches = useStore((s) => s.batches);
  const approveOffer = useStore((s) => s.approveOffer);
  const editOfferDiscount = useStore((s) => s.editOfferDiscount);
  const skipOffer = useStore((s) => s.skipOffer);
  const [isEditing, setIsEditing] = useState(false);

  const dish = DISH_BY_ID[offer.dishId];
  const batch = batches[offer.batchId];
  const thermal = getBatchThermal(batch, now);
  const withdrawn = isOfferWithdrawn(thermal.status);
  const canApprove = canApproveOffer(thermal.status) && !withdrawn;
  const price = offerPrice(offer);

  if (offer.status === "approved") {
    return (
      <div className="rounded-xl border border-matcha/30 bg-oat/5 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-medium text-oat">{dish.name} · {offer.discountPct}% off</span>
          <Chip variant="tinted" tone="matcha">Approved</Chip>
        </div>
        <p className="mt-1.5 text-sm text-oat/70">
          Sent to {offer.sentCount} customers · {offer.reservedCount} reserved
        </p>
      </div>
    );
  }

  if (offer.status === "skipped") {
    return (
      <div className="rounded-xl border border-oat/10 bg-oat/5 p-4 text-sm text-oat/50">
        {dish.name} offer skipped
      </div>
    );
  }

  if (withdrawn) {
    return (
      <div className="rounded-xl border border-signal/40 bg-signal/10 p-4">
        <div className="flex items-center gap-2 text-signal">
          <ShieldAlert size={16} aria-hidden="true" />
          <span className="font-medium">Offer withdrawn</span>
        </div>
        <p className="mt-1.5 text-sm text-oat/70">
          Batch #{batch.id} failed the safety gate — {dish.name} can no longer be offered.
        </p>
        <Button variant="ghost" size="sm" className="mt-3" onClick={() => skipOffer(offer.id)}>
          Dismiss
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-oat/15 bg-oat/5 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-display text-lg font-bold text-oat">
          {dish.name} · {offer.discountPct}% off
        </span>
        <span className="font-mono text-lg font-semibold text-matcha">{formatRupees(price)}</span>
      </div>
      <p className="mt-1 text-sm text-oat/60">
        Batch #{batch.id} · eligible till {formatClock(new Date(offer.eligibleUntilMs))}
      </p>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-oat/5 py-2.5">
          <div className="flex items-center justify-center gap-1 text-oat">
            <PackageSearch size={13} aria-hidden="true" />
            <span className="font-mono text-base font-semibold">{offer.likelyUnsold}</span>
          </div>
          <span className="text-[0.7rem] text-oat/55">likely unsold</span>
        </div>
        <div className="rounded-lg bg-oat/5 py-2.5">
          <div className="flex items-center justify-center gap-1 text-oat">
            <Users2 size={13} aria-hidden="true" />
            <span className="font-mono text-base font-semibold">{offer.matchedOptedIn}</span>
          </div>
          <span className="text-[0.7rem] text-oat/55">matched, opted in</span>
        </div>
        <div className="rounded-lg bg-oat/5 py-2.5">
          <div className="flex items-center justify-center gap-1 text-matcha">
            <Check size={13} aria-hidden="true" />
            <span className="font-mono text-base font-semibold">
              {canApprove ? "OK" : "Review"}
            </span>
          </div>
          <span className="text-[0.7rem] text-oat/55">safety gate</span>
        </div>
      </div>

      {isEditing && (
        <div className="mt-4 flex items-center gap-2">
          <span className="mono-label text-oat/50">Discount</span>
          {DISCOUNT_OPTIONS.map((pct) => (
            <Chip
              key={pct}
              active={offer.discountPct === pct}
              onClick={() => editOfferDiscount(offer.id, pct)}
              className={offer.discountPct !== pct ? "border-oat/20 text-oat/70" : ""}
            >
              {pct}%
            </Chip>
          ))}
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <Button variant="matcha" size="sm" disabled={!canApprove} onClick={() => approveOffer(offer.id)}>
          Approve & send
        </Button>
        <Button variant="ghost" size="sm" onClick={() => setIsEditing((v) => !v)}>
          Edit
        </Button>
        <Button variant="ghost" size="sm" onClick={() => skipOffer(offer.id)}>
          Skip
        </Button>
      </div>
      <p className="mt-3 text-xs text-oat/45">Or reply YES on WhatsApp to publish.</p>
    </div>
  );
}

export function ApprovalQueue({ now }: { now: Date }) {
  const offers = useStore((s) => s.offers);
  const batches = useStore((s) => s.batches);

  const pendingCount = offers.filter((o) => {
    if (o.status !== "pending") return false;
    const batch = batches[o.batchId];
    return batch ? !isOfferWithdrawn(getBatchThermal(batch, now).status) : false;
  }).length;

  return (
    <Card tone="espresso" className="flex flex-col gap-4 p-5 md:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-lg font-bold text-oat">Approval queue</h2>
        <Chip variant="tinted" tone={pendingCount > 0 ? "crema" : "matcha"}>
          {pendingCount} PENDING
        </Chip>
      </div>

      {offers.length === 0 ? (
        <p className="text-sm text-oat/60">Nothing needs you right now.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {offers.map((offer) => (
            <OfferCard key={offer.id} offer={offer} now={now} />
          ))}
        </div>
      )}
    </Card>
  );
}

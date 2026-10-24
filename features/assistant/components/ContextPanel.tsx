"use client";

import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { StatusBadge } from "@/components/feedback/States";
import { qty, shortDate } from "@/lib/formatters";
import { LANG_LABEL, STAGE_LABEL, type ConversationDetail } from "../types";
import { Avatar } from "./Avatar";
import { LogHarvestButton } from "@/features/quality/components/LogHarvestButton";

interface Props {
  detail: ConversationDetail;
  onClose?: () => void;
  canViewProfile: boolean;
}

export function ContextPanel({ detail, onClose, canViewProfile }: Props) {
  const f = detail.farmer;
  const phone = `+${f.phone.slice(0, 2)} ${f.phone.slice(2, 7)} ${f.phone.slice(7)}`;
  const active = detail.offers.filter((o) => o.mine?.status === "COMMITTED" || o.open > 0);
  return (
    <div className="flex h-full flex-col bg-surface">
      <div className="flex h-[60px] shrink-0 items-center justify-between border-b border-hairline px-4">
        <h2 className="text-base font-medium">Farmer details</h2>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close farmer details">
            <X aria-hidden="true" />
          </Button>
        )}
      </div>
      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="flex flex-col items-center gap-2 text-center">
          <Avatar name={f.name} size={72} className="text-xl" />
          <div>
            <p className="text-base font-semibold">{f.name}</p>
            <p className="text-sm text-muted-foreground">{phone}</p>
          </div>
          {canViewProfile && (
            <Link href={`/kisan/farmers/${f.id}`} className="text-sm text-primary underline-offset-4 hover:underline">
              View full profile
            </Link>
          )}
        </div>

        <dl className="space-y-3 text-sm">
          <Row label="Language">{LANG_LABEL[f.language]}</Row>
          <Row label="Village">
            {f.village}, {f.district}
          </Row>
          {f.fpo && <Row label="FPO">{f.fpo}</Row>}
          {f.fieldAgent && <Row label="Field agent">{f.fieldAgent}</Row>}
          {f.areaAcres != null && <Row label="Farm area">{f.areaAcres} acres</Row>}
          {f.lat != null && f.lng != null && (
            <Row label="Location">
              <a
                className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
                href={`https://www.openstreetmap.org/?mlat=${f.lat}&mlon=${f.lng}#map=13/${f.lat}/${f.lng}`}
                target="_blank"
                rel="noreferrer"
              >
                <MapPin className="size-3.5" aria-hidden="true" />
                {f.lat.toFixed(2)}° N, {f.lng.toFixed(2)}° E
              </a>
            </Row>
          )}
        </dl>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Crops</h3>
          <ul className="divide-y divide-hairline rounded-lg border border-hairline text-sm">
            {f.crops.map((c) => (
              <li key={c.crop} className="flex items-center justify-between gap-2 px-3 py-2">
                <span>
                  <span className="block">{c.name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {c.expectedHarvestDate ? `Harvest ~${shortDate(c.expectedHarvestDate)}` : "No harvest date"}
                    {c.expectedQtyKg ? ` · ~${qty(c.expectedQtyKg)}` : ""}
                  </span>
                </span>
                <StatusBadge tone={c.stage === "HARVEST_READY" ? "success" : c.stage === "SOWING" ? "neutral" : "info"}>
                  {STAGE_LABEL[c.stage] ?? c.stage}
                </StatusBadge>
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Active order</h3>
          {active.length === 0 ? (
            <p className="text-sm text-muted-foreground">No open orders for this farmer&apos;s crops.</p>
          ) : (
            <ul className="space-y-3">
              {active.map((o) => (
                <li key={o.id} className="space-y-1 rounded-lg border border-hairline p-3 text-sm">
                  <p className="font-medium">
                    {o.ingredient} · {qty(o.quantity)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {o.mine?.status === "COMMITTED" ? `Committed ${qty(o.mine.quantity)}` : "Not answered yet"} · {qty(o.open)} still needed
                  </p>
                  {o.mine?.status === "COMMITTED" && <LogHarvestButton offerId={o.id} farmerId={f.id} ingredient={o.ingredient} committed={o.mine.quantity} />}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{children}</dd>
    </div>
  );
}

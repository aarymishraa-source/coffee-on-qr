"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, MessagesSquare, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/shadcn/button";
import { DemoChip, EmptyState, ErrorState, Page, PageHeader, StatusBadge } from "@/components/feedback/States";
import { apiGet, apiSend } from "@/lib/fetcher";
import { dateTime, qty, shortDate } from "@/lib/formatters";
import { CONTACT_LABEL, LANGUAGE_LABEL, STAGE_LABEL, formatPhone, toPayload, type FarmerDetail } from "../types";
import { useIngredientNames } from "../hooks";
import { FarmerForm } from "./FarmerForm";

const OFFER_STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "danger" }> = {
  OFFERED: { label: "Waiting for farmers", tone: "warning" },
  PARTIALLY_COMMITTED: { label: "Partly committed", tone: "warning" },
  ACCEPTED: { label: "Fully committed", tone: "success" },
  FULFILLED: { label: "Delivered", tone: "success" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
  DRAFT: { label: "Draft", tone: "neutral" },
};

export function FarmerProfile() {
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const { names } = useIngredientNames();
  const q = useQuery({ queryKey: ["farmer", id], queryFn: () => apiGet<FarmerDetail>(`/api/farmers/${id}`) });

  if (q.isError) {
    return (
      <Page>
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      </Page>
    );
  }
  if (!q.data) {
    return (
      <Page className="space-y-6">
        <div className="h-8 w-56 animate-pulse rounded-lg bg-sunken" />
        <div className="h-64 animate-pulse rounded-xl bg-sunken" />
      </Page>
    );
  }
  const f = q.data;

  const back = (
    <Link href="/kisan/farmers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
      <ArrowLeft className="size-4" aria-hidden="true" /> Farmers
    </Link>
  );

  if (editing) {
    return (
      <Page className="max-w-[960px] space-y-2">
        {back}
        <PageHeader title={`Edit ${f.name}`} />
        <div className="pt-4">
          <FarmerForm
            submitLabel="Save changes"
            onCancel={() => setEditing(false)}
            defaultValues={{
              name: f.name,
              phone: f.phone.slice(2),
              language: f.language,
              village: f.village,
              district: f.district,
              crops: f.crops.map((c) => ({ crop: c.crop, stage: c.stage })),
              fpoId: f.fpoId ?? "",
              fieldAgentId: f.fieldAgentId ?? "",
              areaAcres: f.areaAcres?.toString() ?? "",
              lat: f.lat?.toString() ?? "",
              lng: f.lng?.toString() ?? "",
              contactPreference: f.contactPreference,
              consentData: f.consentData,
              consentFarmStory: f.consentFarmStory,
            }}
            onSubmit={async (values) => {
              await apiSend(`/api/farmers/${f.id}`, toPayload(values), "PATCH");
              toast.success(`${values.name}'s profile saved`);
              await qc.invalidateQueries({ queryKey: ["farmer", id] });
              qc.invalidateQueries({ queryKey: ["farmers"] });
              setEditing(false);
            }}
          />
        </div>
      </Page>
    );
  }

  const facts: [string, string][] = [
    ["Phone", formatPhone(f.phone)],
    ["Language", LANGUAGE_LABEL[f.language]],
    ["Contact by", CONTACT_LABEL[f.contactPreference]],
    ["Village", `${f.village}, ${f.district}`],
    ["FPO", f.fpo ?? "Not a member"],
    ["Field agent", f.fieldAgent ?? "Not assigned"],
    ["Cultivated area", f.areaAcres != null ? `${f.areaAcres} acres` : "Not recorded"],
    ["Farm location", f.lat != null && f.lng != null ? `${f.lat.toFixed(3)}, ${f.lng.toFixed(3)}` : "Not recorded"],
  ];

  return (
    <Page className="space-y-8">
      <div className="space-y-2">
        {back}
        <PageHeader
          title={f.name}
          description={
            <span className="inline-flex flex-wrap items-center gap-2">
              {f.village} · {LANGUAGE_LABEL[f.language]} {f.isDemo && <DemoChip />}
            </span>
          }
          actions={
            <>
              <Button variant="ghost" onClick={() => setEditing(true)}>
                <Pencil aria-hidden="true" />
                Edit profile
              </Button>
              <Button asChild>
                <Link href={`/kisan?farmer=${f.id}`}>
                  <MessagesSquare aria-hidden="true" />
                  Open chat
                </Link>
              </Button>
            </>
          }
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="details-h" className="space-y-3">
          <h2 id="details-h" className="text-base font-semibold">
            Details
          </h2>
          <dl className="divide-y divide-hairline rounded-xl border border-hairline bg-surface text-sm">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 px-4 py-2.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="tabular text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="crops-h" className="space-y-3">
            <h2 id="crops-h" className="text-base font-semibold">
              Crops
            </h2>
            <ul className="divide-y divide-hairline rounded-xl border border-hairline bg-surface text-sm">
              {f.crops.map((c) => (
                <li key={c.crop} className="flex items-center justify-between gap-4 px-4 py-2.5">
                  <span>
                    <span className="font-medium">{names[c.crop] ?? c.crop}</span>
                    <span className="block text-xs text-muted-foreground">
                      {c.expectedHarvestDate ? `Harvest around ${shortDate(c.expectedHarvestDate)}` : "No harvest date yet"}
                      {c.expectedQtyKg ? ` · ~${qty(c.expectedQtyKg)}` : ""}
                    </span>
                  </span>
                  <StatusBadge tone={c.stage === "HARVEST_READY" ? "success" : "neutral"}>{STAGE_LABEL[c.stage]}</StatusBadge>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="consent-h" className="space-y-3">
            <h2 id="consent-h" className="text-base font-semibold">
              Consent
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center justify-between gap-4">
                <span>Store details and send messages</span>
                <StatusBadge tone={f.consentData ? "success" : "danger"}>{f.consentData ? "Agreed" : "Not given"}</StatusBadge>
              </li>
              <li className="flex items-center justify-between gap-4">
                <span>Name shown on café menus</span>
                <StatusBadge tone={f.consentFarmStory ? "success" : "neutral"}>{f.consentFarmStory ? "Agreed" : "Not shared"}</StatusBadge>
              </li>
            </ul>
            {f.consentAt && <p className="text-xs text-muted-foreground">Last recorded {dateTime(f.consentAt)}</p>}
          </section>
        </div>
      </div>

      <section aria-labelledby="commit-h" className="space-y-3">
        <h2 id="commit-h" className="text-base font-semibold">
          Supply commitments
        </h2>
        <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
          {f.commitments.length === 0 ? (
            <EmptyState title="No commitments yet" body="When a café order matches this farmer's crops, it appears in their chat. Their answers show up here." />
          ) : (
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Crop</th>
                  <th className="px-4 py-3 text-right font-normal">Committed</th>
                  <th className="px-4 py-3 text-right font-normal">Order size</th>
                  <th className="px-4 py-3 font-normal">Needed by</th>
                  <th className="px-4 py-3 font-normal">Order status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {f.commitments.map((c) => {
                  const s = OFFER_STATUS[c.offerStatus] ?? { label: c.offerStatus, tone: "neutral" as const };
                  return (
                    <tr key={c.id}>
                      <td className="px-4 py-3 font-medium">{c.ingredient}</td>
                      <td className="tabular px-4 py-3 text-right">{c.status === "DECLINED" ? "Declined" : qty(c.quantity, c.unit)}</td>
                      <td className="tabular px-4 py-3 text-right text-muted-foreground">{qty(c.offerQuantity, c.unit)}</td>
                      <td className="px-4 py-3">{shortDate(c.neededBy)}</td>
                      <td className="px-4 py-3">
                        <StatusBadge tone={s.tone}>{s.label}</StatusBadge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </Page>
  );
}

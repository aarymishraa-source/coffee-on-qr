"use client";

import { useDeferredValue, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus } from "lucide-react";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/shadcn/select";
import { DemoChip, EmptyState, ErrorState, Page, PageHeader, SkeletonRows } from "@/components/feedback/States";
import { apiGet } from "@/lib/fetcher";
import { LANGUAGES, LANGUAGE_LABEL, STAGES, STAGE_LABEL, formatPhone, type FarmerRow } from "../types";
import { useIngredientNames } from "../hooks";

const ALL = "all";

export function FarmerList() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [crop, setCrop] = useState(ALL);
  const [stage, setStage] = useState(ALL);
  const [language, setLanguage] = useState(ALL);
  const query = useDeferredValue(q);
  const { names, options } = useIngredientNames();

  const params = new URLSearchParams();
  if (query.trim()) params.set("q", query.trim());
  if (crop !== ALL) params.set("crop", crop);
  if (stage !== ALL) params.set("stage", stage);
  if (language !== ALL) params.set("language", language);
  const qs = params.toString();

  const farmers = useQuery({
    queryKey: ["farmers", qs],
    queryFn: () => apiGet<FarmerRow[]>(`/api/farmers${qs ? `?${qs}` : ""}`),
    placeholderData: (prev) => prev,
  });
  const filtered = qs.length > 0;

  return (
    <Page className="space-y-6">
      <PageHeader
        title="Farmers"
        description="Farmers you can see and help. Field agents see only the farmers assigned to them."
        actions={
          <Button asChild>
            <Link href="/kisan/farmers/new">
              <UserPlus aria-hidden="true" />
              Register a farmer
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <div className="relative min-w-0 sm:w-72">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, village or phone"
            aria-label="Search farmers"
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-3 gap-2 sm:flex">
          <FilterSelect label="Crop" value={crop} onChange={setCrop} options={options.map((o) => ({ value: o.id, label: o.name }))} allLabel="All crops" />
          <FilterSelect label="Stage" value={stage} onChange={setStage} options={STAGES} allLabel="All stages" />
          <FilterSelect label="Language" value={language} onChange={setLanguage} options={LANGUAGES.map((l) => ({ value: l.value, label: LANGUAGE_LABEL[l.value] }))} allLabel="All languages" />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        {farmers.isError ? (
          <ErrorState message={(farmers.error as Error).message} onRetry={() => farmers.refetch()} />
        ) : !farmers.data ? (
          <SkeletonRows rows={6} />
        ) : farmers.data.length === 0 ? (
          filtered ? (
            <EmptyState
              title="No farmers match"
              body="Try a different search or clear the filters."
              action={
                <Button variant="outline" size="sm" onClick={() => (setQ(""), setCrop(ALL), setStage(ALL), setLanguage(ALL))}>
                  Clear filters
                </Button>
              }
            />
          ) : (
            <EmptyState title="No farmers yet" body="Register the first farmer to start sending them café orders." />
          )
        ) : (
          <>
            {/* Desktop table */}
            <table className="hidden w-full text-sm md:table">
              <thead>
                <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-normal">Farmer</th>
                  <th className="px-4 py-3 font-normal">Village</th>
                  <th className="px-4 py-3 font-normal">Crops</th>
                  <th className="px-4 py-3 font-normal">Language</th>
                  <th className="px-4 py-3 font-normal">Field agent</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hairline">
                {farmers.data.map((f) => (
                  <tr
                    key={f.id}
                    tabIndex={0}
                    onClick={() => router.push(`/kisan/farmers/${f.id}`)}
                    onKeyDown={(e) => e.key === "Enter" && router.push(`/kisan/farmers/${f.id}`)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-sunken/60 focus-visible:bg-sunken focus-visible:outline-none"
                  >
                    <td className="px-4 py-3">
                      <span className="flex items-center gap-2 font-medium">
                        {f.name} {f.isDemo && <DemoChip>Demo</DemoChip>}
                      </span>
                      <span className="tabular block text-xs text-muted-foreground">{formatPhone(f.phone)}</span>
                    </td>
                    <td className="px-4 py-3">
                      {f.village}
                      <span className="block text-xs text-muted-foreground">{f.district}</span>
                    </td>
                    <td className="px-4 py-3">
                      {f.crops.map((c) => (
                        <span key={c.crop} className="block">
                          {names[c.crop] ?? c.crop} <span className="text-xs text-muted-foreground">· {STAGE_LABEL[c.stage]}</span>
                        </span>
                      ))}
                    </td>
                    <td className="px-4 py-3">{LANGUAGE_LABEL[f.language]}</td>
                    <td className="px-4 py-3 text-muted-foreground">{f.fieldAgent ?? "Not assigned"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Mobile list */}
            <ul className="divide-y divide-hairline md:hidden">
              {farmers.data.map((f) => (
                <li key={f.id}>
                  <Link href={`/kisan/farmers/${f.id}`} className="block px-4 py-3 active:bg-sunken">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{LANGUAGE_LABEL[f.language]}</span>
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {f.village} · {f.crops.map((c) => `${names[c.crop] ?? c.crop} (${STAGE_LABEL[c.stage].toLowerCase()})`).join(", ")}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
      {farmers.data && farmers.data.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {farmers.data.length} farmer{farmers.data.length === 1 ? "" : "s"}
        </p>
      )}
    </Page>
  );
}

function FilterSelect({
  label, value, onChange, options, allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger aria-label={`Filter by ${label.toLowerCase()}`} className="w-full sm:w-40">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{allLabel}</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

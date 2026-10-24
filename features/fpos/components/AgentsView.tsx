"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { EmptyState, ErrorState, Page, PageHeader, SkeletonRows } from "@/components/feedback/States";
import { apiGet } from "@/lib/fetcher";
import { formatPhone } from "@/features/farmers/types";
import { useIngredientNames } from "@/features/farmers/hooks";

interface Agent {
  id: string;
  name: string;
  phone: string;
  fpo: string;
  farmerCount: number;
  farmers: { id: string; name: string; village: string; crops: string[] }[];
}

export function AgentsView() {
  const { names } = useIngredientNames();
  const q = useQuery({ queryKey: ["agents"], queryFn: () => apiGet<Agent[]>("/api/agents") });

  return (
    <Page className="space-y-6">
      <PageHeader title="Field agents" description="Who looks after which farmers. Agents register farmers and help them in the chat." />
      {q.isError ? (
        <ErrorState message={(q.error as Error).message} onRetry={() => q.refetch()} />
      ) : !q.data ? (
        <SkeletonRows rows={4} className="rounded-xl border border-hairline bg-surface" />
      ) : q.data.length === 0 ? (
        <div className="rounded-xl border border-hairline bg-surface">
          <EmptyState title="No field agents yet" body="Field agents are added by an admin. Once added, they can register and help farmers." />
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {q.data.map((a) => (
            <li key={a.id} className="rounded-xl border border-hairline bg-surface">
              <div className="flex items-baseline justify-between gap-3 border-b border-hairline px-5 py-4">
                <div>
                  <p className="font-medium">{a.name}</p>
                  <p className="tabular text-xs text-muted-foreground">
                    {formatPhone(a.phone)} · {a.fpo}
                  </p>
                </div>
                <p className="tabular text-sm text-muted-foreground">
                  {a.farmerCount} farmer{a.farmerCount === 1 ? "" : "s"}
                </p>
              </div>
              {a.farmers.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted-foreground">No farmers assigned yet.</p>
              ) : (
                <ul className="divide-y divide-hairline">
                  {a.farmers.map((f) => (
                    <li key={f.id}>
                      <Link
                        href={`/kisan/farmers/${f.id}`}
                        className="flex items-baseline justify-between gap-3 px-5 py-2.5 text-sm transition-colors duration-150 hover:bg-sunken/60"
                      >
                        <span>{f.name}</span>
                        <span className="truncate text-xs text-muted-foreground">
                          {f.village} · {f.crops.map((c) => names[c] ?? c).join(", ")}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Page>
  );
}

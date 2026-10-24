import { Suspense } from "react";
import { requirePage } from "@/server/auth/guard";
import { integrationStatus } from "@/server/services/integrations.service";
import { Page, PageHeader, StatusBadge } from "@/components/feedback/States";
import { ResetDemoButton } from "@/features/settings/ResetDemoButton";

export const metadata = { title: "Integrations — Coffee on QR" };

const STATE = {
  connected: { label: "Connected", tone: "success" as const },
  demo: { label: "Demo fallback", tone: "neutral" as const },
  not_configured: { label: "Not configured", tone: "warning" as const },
};

async function Integrations() {
  await requirePage("/console/settings/integrations");
  const rows = integrationStatus();
  return (
    <Page className="space-y-8">
      <PageHeader
        title="Integrations"
        description="Which providers are live. Connected means keys are set on the server; secrets are never shown here."
      />
      <div className="overflow-x-auto rounded-xl border border-hairline bg-surface">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-hairline text-left text-xs text-muted-foreground">
              <th className="px-4 py-3 font-normal">Provider</th>
              <th className="px-4 py-3 font-normal">Status</th>
              <th className="px-4 py-3 font-normal">What happens now</th>
              <th className="px-4 py-3 font-normal">Environment variables</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {rows.map((r) => (
              <tr key={r.id} className="align-top">
                <td className="px-4 py-3 font-medium">{r.name}</td>
                <td className="px-4 py-3">
                  <StatusBadge tone={STATE[r.state].tone}>{STATE[r.state].label}</StatusBadge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {r.detail}
                  {r.doc && <span className="block text-xs">Setup: {r.doc}</span>}
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs leading-relaxed text-muted-foreground">{r.vars.join(" · ")}</code>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <section className="flex flex-col gap-3 border-t border-hairline pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Demo data</h2>
          <p className="text-sm text-muted-foreground">Restore the seeded demo records. Records not flagged as demo data are never touched.</p>
        </div>
        <ResetDemoButton />
      </section>
    </Page>
  );
}

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="mx-auto h-96 max-w-[1200px] animate-pulse rounded-xl bg-sunken p-8" />}>
      <Integrations />
    </Suspense>
  );
}

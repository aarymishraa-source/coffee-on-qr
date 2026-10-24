"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/feedback/States";
import { apiSend } from "@/lib/fetcher";
import { toPayload } from "../types";
import { FarmerForm } from "./FarmerForm";

export function NewFarmer() {
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <Page className="max-w-[960px] space-y-2">
      <Link href="/kisan/farmers" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Farmers
      </Link>
      <PageHeader title="Register a farmer" description="Takes about two minutes. Fields marked optional can be added later." />
      <div className="pt-4">
        <FarmerForm
          submitLabel="Register farmer"
          onCancel={() => router.push("/kisan/farmers")}
          onSubmit={async (values) => {
            const r = await apiSend<{ id: string; name: string }>("/api/farmers", toPayload(values));
            toast.success(`${r.name} registered`);
            qc.invalidateQueries({ queryKey: ["farmers"] });
            router.push(`/kisan/farmers/${r.id}`);
          }}
        />
      </div>
    </Page>
  );
}

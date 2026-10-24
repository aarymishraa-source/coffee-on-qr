import { Suspense, type ReactNode } from "react";
import { requirePage } from "@/server/auth/guard";

async function Gate({ path, children }: { path: string; children: ReactNode }) {
  await requirePage(path);
  return <>{children}</>;
}

function PageSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-6 px-4 py-6 md:px-8 md:py-8" aria-busy="true">
      <div className="h-8 w-56 animate-pulse rounded-lg bg-sunken" />
      <div className="h-24 animate-pulse rounded-xl bg-sunken" />
      <div className="h-72 animate-pulse rounded-xl bg-sunken" />
    </div>
  );
}

/** Role-checks a page on the server (requirePage) inside its own Suspense boundary. */
export function Guarded({ path, children }: { path: string; children: ReactNode }) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Gate path={path}>{children}</Gate>
    </Suspense>
  );
}

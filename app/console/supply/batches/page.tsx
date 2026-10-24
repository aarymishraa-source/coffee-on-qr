import { Guarded } from "@/components/layout/Guarded";
import { BatchesView } from "@/features/quality/components/BatchesView";

export const metadata = { title: "Harvest batches — Coffee on QR" };

export default function BatchesPage() {
  return (
    <Guarded path="/console/supply/batches">
      <BatchesView />
    </Guarded>
  );
}

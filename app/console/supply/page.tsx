import { Guarded } from "@/components/layout/Guarded";
import { SupplyDashboard } from "@/features/demand/components/SupplyDashboard";

export const metadata = { title: "Supply forecast — Coffee on QR" };

export default function SupplyPage() {
  return (
    <Guarded path="/console/supply">
      <SupplyDashboard />
    </Guarded>
  );
}

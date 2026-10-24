import { Guarded } from "@/components/layout/Guarded";
import { PaymentsView } from "@/features/payments/components/PaymentsView";

export const metadata = { title: "Payments — Coffee on QR" };

export default function PaymentsPage() {
  return (
    <Guarded path="/console/supply/payments">
      <PaymentsView />
    </Guarded>
  );
}

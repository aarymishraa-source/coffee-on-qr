import { Guarded } from "@/components/layout/Guarded";
import { OrdersView } from "@/features/orders/components/OrdersView";

export const metadata = { title: "Farm orders — Coffee on QR" };

export default function OrdersPage() {
  return (
    <Guarded path="/console/supply/orders">
      <OrdersView />
    </Guarded>
  );
}

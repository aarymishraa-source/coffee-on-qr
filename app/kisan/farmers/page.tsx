import { Guarded } from "@/components/layout/Guarded";
import { FarmerList } from "@/features/farmers/components/FarmerList";

export const metadata = { title: "Farmers — Coffee on QR" };

export default function Page() {
  return (
    <Guarded path="/kisan/farmers">
      <FarmerList />
    </Guarded>
  );
}

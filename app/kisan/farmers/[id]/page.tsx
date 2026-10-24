import { Guarded } from "@/components/layout/Guarded";
import { FarmerProfile } from "@/features/farmers/components/FarmerProfile";

export const metadata = { title: "Farmer profile — Coffee on QR" };

export default function Page() {
  return (
    <Guarded path="/kisan/farmers">
      <FarmerProfile />
    </Guarded>
  );
}

import { Guarded } from "@/components/layout/Guarded";
import { NewFarmer } from "@/features/farmers/components/NewFarmer";

export const metadata = { title: "Register a farmer — Coffee on QR" };

export default function Page() {
  return (
    <Guarded path="/kisan/farmers/new">
      <NewFarmer />
    </Guarded>
  );
}

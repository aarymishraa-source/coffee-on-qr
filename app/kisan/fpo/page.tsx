import { Guarded } from "@/components/layout/Guarded";
import { FpoOverview } from "@/features/fpos/components/FpoOverview";

export const metadata = { title: "FPO overview — Coffee on QR" };

export default function Page() {
  return (
    <Guarded path="/kisan/fpo">
      <FpoOverview />
    </Guarded>
  );
}

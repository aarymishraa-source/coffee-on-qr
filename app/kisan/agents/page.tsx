import { Guarded } from "@/components/layout/Guarded";
import { AgentsView } from "@/features/fpos/components/AgentsView";

export const metadata = { title: "Field agents — Coffee on QR" };

export default function Page() {
  return (
    <Guarded path="/kisan/agents">
      <AgentsView />
    </Guarded>
  );
}

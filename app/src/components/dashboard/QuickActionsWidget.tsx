import QuickActions from "@/components/QuickActions";
import { Panel } from "@/components/ui";

/**
 * Ações rápidas dashboard widget: one-tap shortcuts to the main corredor loops
 * (trampos, saideira, cromo, PvP, vendedores) inside the shared Panel frame.
 */
export default function QuickActionsWidget() {
  return (
    <Panel title="AÇÕES RÁPIDAS">
      <QuickActions />
    </Panel>
  );
}

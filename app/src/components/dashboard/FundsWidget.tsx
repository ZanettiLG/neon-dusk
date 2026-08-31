import { useEffect } from "react";
import { useHudStore } from "@/stores/hud";
import { formatEds } from "@/lib/format";
import { Panel } from "@/components/ui";

/**
 * Grana dashboard widget: wallet balance from the HUD store with the escrow
 * (grana empenhada em negócios pendentes) called out when present. Fires the
 * HUD refresh on mount when the store has not been hydrated yet (the app shell
 * usually does it first — the guard avoids a duplicate 4-endpoint fetch).
 */
export default function FundsWidget() {
  const balance = useHudStore((s) => s.balance);
  const balanceError = useHudStore((s) => s.balanceError);
  const escrow = useHudStore((s) => s.escrow);
  const refresh = useHudStore((s) => s.refresh);

  useEffect(() => {
    if (balance === null && !balanceError) void refresh();
  }, [balance, balanceError, refresh]);

  return (
    <Panel
      title="GRANA"
      status={balanceError ? "error" : balance === null ? "loading" : "default"}
      errorMessage="Grana indisponível"
      onRetry={() => void refresh()}
    >
      {balance !== null && (
        <div className="space-y-2">
          <p className="font-data text-3xl text-nd-gold">{formatEds(balance)}</p>
          {(escrow ?? 0) > 0 && (
            <p className="font-data text-xs text-nd-text-secondary">
              <span className="text-nd-gold">{formatEds(escrow ?? 0)}</span> empenhados em negócios
              pendentes
            </p>
          )}
        </div>
      )}
    </Panel>
  );
}

import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { formatCountdown } from "@/lib/format";
import { ActionButton, MetricBar, Panel } from "@/components/ui";
import type { ActionStatus } from "@/components/ui";

/**
 * NIL dashboard widget: neural load bar, live regen countdown ("Próximo +1")
 * and the Pingado action. No cooldown (#187) — the cap is the ceiling.
 */
export default function NilWidget() {
  const nilStatus = useAuthStore((s) => s.nilStatus);
  const nilLoading = useAuthStore((s) => s.nilLoading);
  const nilError = useAuthStore((s) => s.nilError);
  const fetchNil = useAuthStore((s) => s.fetchNil);
  const useStim = useAuthStore((s) => s.useStim);

  // Seconds until the next regen tick — resyncs whenever a fresh status lands.
  const [countdown, setCountdown] = useState(nilStatus?.nextTickSeconds ?? 0);

  // Mount guard (FundsWidget pattern): the persistent HUD usually hydrated
  // nilStatus already — skip the duplicate GET when a readout exists.
  useEffect(() => {
    if (!nilStatus && !nilLoading && !nilError) void fetchNil();
  }, [nilStatus, nilLoading, nilError, fetchNil]);

  useEffect(() => {
    setCountdown(nilStatus?.nextTickSeconds ?? 0);
  }, [nilStatus?.nextTickSeconds]);

  // 1s tick with a pure updater (StrictMode-safe, see react-patterns).
  useEffect(() => {
    if (!nilStatus?.regenerating) return;
    const timer = setInterval(() => setCountdown((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [nilStatus?.regenerating]);

  // Regen tick landed — refetch to accrue the point and get the next tick.
  useEffect(() => {
    if (countdown === 0 && nilStatus?.regenerating) void fetchNil();
  }, [countdown, nilStatus?.regenerating, fetchNil]);
  const etaText =
    !nilStatus || !nilStatus.regenerating
      ? "NIL CHEIO"
      : countdown > 0
        ? `Próximo +1 em ${formatCountdown(countdown)}`
        : "Sincronizando NIL...";

  const pingadoStatus: ActionStatus = nilLoading ? "loading" : nilError ? "error" : "default";

  /** Fire the ampola; errors surface through nilError (store) — no cooldown branch (#187). */
  async function onUseStim(): Promise<void> {
    try {
      await useStim();
    } catch {
      // intentionally silent — the store already surfaced the error
    }
  }

  return (
    <Panel
      title="NIL // CARGA NEURAL"
      status={nilStatus ? "default" : nilLoading || !nilError ? "loading" : "error"}
      errorMessage="NIL indisponível"
      onRetry={() => void fetchNil()}
    >
      {nilStatus && (
        <div className="space-y-3">
          <MetricBar resource="nil" value={nilStatus.current} max={nilStatus.max} label="NIL" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-data text-xs text-nd-text-secondary">{etaText}</span>
            <ActionButton
              status={pingadoStatus}
              errorMessage={nilError ?? undefined}
              disabled={!nilStatus.regenerating}
              onClick={() => void onUseStim()}
            >
              PINGADO
            </ActionButton>
          </div>
          <p className="font-data text-nd-micro text-nd-text-secondary">
            Brinde gratuito — sem cooldown
          </p>
        </div>
      )}
    </Panel>
  );
}

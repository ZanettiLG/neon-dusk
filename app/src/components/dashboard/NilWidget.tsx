import { useEffect, useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { ApiError } from "@/api/client";
import { NIL_SYN_CAFE_COOLDOWN_S } from "@neon-dusk/shared";
import { formatCountdown, formatDuration } from "@/lib/format";
import { ActionButton, MetricBar, Panel } from "@/components/ui";
import type { ActionStatus } from "@/components/ui";

/**
 * NIL dashboard widget: neural load bar, live regen countdown ("Próximo +1")
 * and the Pingado action with its 1h cooldown. The cooldown is not exposed by
 * GET nil — it surfaces as `NIL_STIM_COOLDOWN` (details.retryAfterSeconds)
 * when the ampola is still brewing, and the widget ticks it down locally.
 */
export default function NilWidget() {
  const nilStatus = useAuthStore((s) => s.nilStatus);
  const nilLoading = useAuthStore((s) => s.nilLoading);
  const nilError = useAuthStore((s) => s.nilError);
  const fetchNil = useAuthStore((s) => s.fetchNil);
  const useStim = useAuthStore((s) => s.useStim);

  // Seconds until the next regen tick — resyncs whenever a fresh status lands.
  const [countdown, setCountdown] = useState(nilStatus?.nextTickSeconds ?? 0);
  // Pingado cooldown (server-gated); 0 = ready.
  const [pingadoCooldownS, setPingadoCooldownS] = useState(0);

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

  // Local 1s tick for the Pingado (ampola) cooldown; stops at zero.
  useEffect(() => {
    if (pingadoCooldownS <= 0) return;
    const timer = setInterval(() => setPingadoCooldownS((p) => Math.max(0, p - 1)), 1000);
    return () => clearInterval(timer);
  }, [pingadoCooldownS]);

  async function onUseStim(): Promise<void> {
    try {
      await useStim();
      // Countdown resyncs via nilStatus.nextTickSeconds effect.
    } catch (err) {
      if (err instanceof ApiError && err.code === "NIL_STIM_COOLDOWN") {
        const retry = (err.details as { retryAfterSeconds?: number } | undefined)
          ?.retryAfterSeconds;
        setPingadoCooldownS(retry && retry > 0 ? retry : NIL_SYN_CAFE_COOLDOWN_S);
      }
      // Other errors already surfaced through nilError.
    }
  }

  const etaText =
    !nilStatus || !nilStatus.regenerating
      ? "NIL CHEIO"
      : countdown > 0
        ? `Próximo +1 em ${formatCountdown(countdown)}`
        : "Sincronizando NIL...";

  const pingadoStatus: ActionStatus =
    pingadoCooldownS > 0 ? "cooldown" : nilLoading ? "loading" : nilError ? "error" : "default";

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
              cooldownRemainingS={pingadoCooldownS}
              cooldownLabel="Pingado em"
              errorMessage={nilError ?? undefined}
              disabled={!nilStatus.regenerating}
              onClick={() => void onUseStim()}
            >
              PINGADO
            </ActionButton>
          </div>
          <p className="font-data text-nd-micro text-nd-text-secondary">
            Brinde gratuito — {formatDuration(NIL_SYN_CAFE_COOLDOWN_S)} cooldown
          </p>
        </div>
      )}
    </Panel>
  );
}

import { useEffect, useRef, useState } from "react";
import type { HumanityInfo } from "@neon-dusk/shared";
import ActionButton from "@/components/ui/ActionButton";
import Panel from "@/components/ui/Panel";
import { useCountdownTo } from "@/lib/useCountdownTo";
import { useConsumablesStore } from "@/stores/consumables";

interface ConsumablesPanelProps {
  /** Humanity readout used for pro-active gating (flatline / banda Íntegro). */
  info: HumanityInfo | null;
}

/** Static diminishing-returns copy (ADR 28-B — global rolling 24h window). */
const DIMINISHING_COPY = "Restauração reduzida após usos repetidos (100/60/30% por 24h).";

/** Pro-active gating reasons (mirror the server's FLATLINED / BAND_TOO_HIGH). */
const FLATLINED_REASON = "Personagem apagado. Sem ações permitidas.";
const BAND_TOO_HIGH_REASON = "Sua humanidade está alta demais para isso (máx. 70).";

/**
 * Consumables panel (issue #48) — itens anti-insanidade: catalog cards with
 * owned stock, per-item cooldowns and a 2-step inline confirmation before
 * POSTing the use. The server stays authoritative on cost, restore and
 * cooldown; pro-active gating mirrors TherapyPanel (flatline / banda Íntegro).
 * Self-contained: fetches its own readout on mount via the consumables store.
 */
export default function ConsumablesPanel({ info }: ConsumablesPanelProps) {
  const mountedRef = useRef(true);
  const items = useConsumablesStore((s) => s.items);
  const loading = useConsumablesStore((s) => s.loading);
  const error = useConsumablesStore((s) => s.error);
  const usingItemId = useConsumablesStore((s) => s.usingItemId);
  const useError = useConsumablesStore((s) => s.useError);
  const lastUse = useConsumablesStore((s) => s.lastUse);
  const fetch = useConsumablesStore((s) => s.fetch);
  const useItem = useConsumablesStore((s) => s.useItem);

  // 2-step inline confirmation (no modal): 1st click arms, 2nd fires.
  const [confirmingItemId, setConfirmingItemId] = useState<string | null>(null);
  // Per-card feedback — which item the last use / last error belongs to.
  const [lastUsedItemId, setLastUsedItemId] = useState<string | null>(null);
  const [failedItemId, setFailedItemId] = useState<string | null>(null);

  // Live countdown for COOLDOWN_ACTIVE errors (details.nextAvailableAt).
  const errorUnlockAt =
    useError?.code === "COOLDOWN_ACTIVE" && useError.nextAvailableAt
      ? new Date(useError.nextAvailableAt).getTime()
      : null;
  const errorUnlockSeconds = useCountdownTo(errorUnlockAt);

  useEffect(() => {
    mountedRef.current = true;
    void fetch();
    return () => {
      mountedRef.current = false;
    };
  }, [fetch]);

  async function onUse(itemId: string) {
    setConfirmingItemId(null);
    setFailedItemId(null);
    try {
      await useItem(itemId);
      if (mountedRef.current) setLastUsedItemId(itemId);
    } catch {
      // The store already surfaced the structured error — swallow the re-throw
      // so the click handler never leaves an unhandled rejection.
      if (mountedRef.current) setFailedItemId(itemId);
    }
  }

  const flatlined = info?.flatlined ?? false;
  const bandTooHigh = info?.band === "integro";
  const status =
    loading && !items
      ? "loading"
      : error && !items
        ? "error"
        : items && items.length === 0
          ? "empty"
          : "default";

  return (
    <Panel
      title="CONSUMÍVEIS"
      status={status}
      errorMessage={error ?? undefined}
      onRetry={() => void fetch()}
      emptyMessage="Nenhum consumível disponível."
    >
      <p className="text-nd-text-secondary text-xs font-data">{DIMINISHING_COPY}</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
        {items?.map((item) => {
          const nextAt = item.nextAvailableAt ? new Date(item.nextAvailableAt).getTime() : null;
          const cooldownSeconds =
            nextAt === null ? 0 : Math.max(0, Math.ceil((nextAt - Date.now()) / 1000));
          const cooldownActive = cooldownSeconds > 0;
          const outOfStock = item.ownedQuantity <= 0;
          const confirming = confirmingItemId === item.id;
          const using = usingItemId === item.id;

          const showSuccess = lastUsedItemId === item.id && lastUse !== null;
          const showError = failedItemId === item.id && useError !== null;
          const errorMessage =
            useError?.code === "COOLDOWN_ACTIVE" && useError.nextAvailableAt
              ? `Este item ainda está em cooldown. Disponível em ${formatCooldown(errorUnlockSeconds)}.`
              : useError?.message;
          const buttonChildren = outOfStock
            ? "Sem estoque"
            : confirming
              ? "Confirmar uso?"
              : "Usar";
          const onButtonClick = () =>
            confirming ? void onUse(item.id) : setConfirmingItemId(item.id);

          return (
            <div key={item.id} className="border border-nd-cyan/15 rounded-terminal p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-heading text-nd-cyan text-sm">{item.name}</h3>
                <span className="font-data text-[10px] uppercase tracking-widest text-nd-purple">
                  Tier {item.tier}
                </span>
              </div>
              <p className="text-xs font-data text-nd-text">
                <span className="text-nd-green">restaura +{item.restoreAmount}</span> ·{" "}
                <span className="text-nd-text-secondary">{item.ownedQuantity} em estoque</span>
              </p>
              <p className="text-[11px] font-data text-nd-text-secondary">
                {item.cooldownHours > 0 ? `Cooldown de ${item.cooldownHours}h` : "Sem cooldown"}
              </p>
              {flatlined || bandTooHigh ? (
                <ActionButton
                  status="blocked"
                  blockReason={flatlined ? FLATLINED_REASON : BAND_TOO_HIGH_REASON}
                  onClick={onButtonClick}
                >
                  {buttonChildren}
                </ActionButton>
              ) : (
                <ActionButton
                  variant={confirming ? "gold" : "default"}
                  status={cooldownActive ? "cooldown" : using ? "loading" : "default"}
                  cooldownRemainingS={cooldownActive ? cooldownSeconds : undefined}
                  cooldownLabel="Cooldown"
                  disabled={outOfStock}
                  onClick={onButtonClick}
                >
                  {buttonChildren}
                </ActionButton>
              )}
              {showSuccess && (
                <p className="text-nd-green text-xs font-data">
                  {item.name}: +{lastUse.restored} de humanidade ({lastUse.humanityBefore} →{" "}
                  {lastUse.humanityAfter}).
                </p>
              )}
              {showError && errorMessage && (
                <p role="alert" className="text-nd-magenta text-xs font-data">
                  {errorMessage}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/** Seconds → "12h" / "1d 3h" (days without hours when hours are zero). */
function formatCooldown(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const d = Math.floor(s / 86_400);
  const h = Math.floor((s % 86_400) / 3600);
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  return `${h}h`;
}

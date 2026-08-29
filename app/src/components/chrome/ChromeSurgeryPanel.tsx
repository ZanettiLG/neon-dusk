import { useEffect, useRef, useState } from "react";
import type {
  AttributeKey,
  Character,
  ChromeDefinition,
  ChromeSlot,
  InstalledChromeResponse,
} from "@neon-dusk/shared";
import { SLOT_CAPACITY } from "@neon-dusk/shared";
import { api } from "@/api/client";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { ATTRIBUTE_LABELS, CHROME_SLOT_LABELS } from "@/lib/labels";
import { formatEds } from "@/lib/format";
import ActionButton from "@/components/ui/ActionButton";
import MetricBar from "@/components/ui/MetricBar";
import TypewriterText, { prefersReducedMotion } from "./TypewriterText";

// idle → slot_selected → reviewing → confirming → surgery_playing → done.
// (handoff listed a separate implant_selected step; the implant pick IS the
// review screen — one screen shows selection, custo, antes/depois e confirmar.)
type Stage = "idle" | "slot_selected" | "reviewing" | "confirming" | "surgery_playing" | "done";

/** Diegetic theater duration (collapses to 0 under prefers-reduced-motion). */
const SURGERY_MS = 5000;

/** Log do Ferrageiro (tom de voz oficial — cyberpunk-lore skill). */
const SURGERY_LOG =
  "O Ferrageiro terminou. Você sente o cromo se fundir aos nervos. Algo dentro de você ficou mais forte. Algo dentro de você se foi.";

const ATTR_KEYS: AttributeKey[] = ["body", "reflexes", "intelligence", "technical", "cool"];

interface ChromeSurgeryPanelProps {
  slot: ChromeSlot | null;
  catalog: ChromeDefinition[];
  installed: InstalledChromeResponse | null;
  vendorId: string | null;
  /**
   * Preço de estoque do ferrageiro por id de definição de cromo (do inventário
   * de GET /api/vendors/:id, itemType === "CHROME"). Entradas ausentes caem no
   * `basePrice` do catálogo — conservador, mas o server continua autoridade na
   * cobrança real (usa `stockItem.price`, nunca `base_price`).
   */
  vendorPrices?: Record<string, number> | null;
  /** True while the parent is still loading catalog/installed. */
  loading: boolean;
  /** Error from the installed fetch (parent); when set with no cached loadout,
   * the panel shows a retry instead of hanging in "loading..." forever. */
  error?: string | null;
  /** Retry callback for the installed fetch (parent). */
  onRetry?: () => void;
  /** Fired once the surgery theater finishes — parent reloads installed + HUD. */
  onSurgeryDone: () => void;
}

/**
 * Mirror of the server's `getOverclockBonus` gate (feature #65): the
 * gambiarrista's Overclock is active while the one-shot ability is pending
 * consumption. One-shot abilities never auto-expire (activeUntil is a flag),
 * so this follows `resolveAbilityState` rules from the raw timestamps instead
 * of the API's `isActive` flag (which only reflects a FUTURE timestamp):
 * activeUntil set AND cooldown not yet expired → active.
 *
 * The mirror uses `character.ability` from the auth store; if that data is
 * stale (e.g. activated elsewhere without a refetch), the check falls back to
 * "not active" — conservative, same as any client-side cost estimate.
 *
 * @param character - Character from the auth store (null = logged out/loading).
 * @param now       - Reference time (injectable for tests).
 */
export function isOverclockActive(character: Character | null, now: number = Date.now()): boolean {
  if (!character || character.role !== "gambiarrista") return false;
  const ability = character.ability;
  if (!ability || ability.abilityType !== "overclock" || !ability.activeUntil) return false;
  if (ability.cooldownUntil && Date.parse(ability.cooldownUntil) < now) return false;
  return true;
}

/**
 * Surgery flow for one body slot (issue #10): pick an implant from the
 * slot-filtered catalog, review cost + before/after (computed client-side —
 * the server stays authoritative on the install), confirm, watch the ~5s
 * Ferrageiro theater, done. The HUD is refreshed by the parent on done.
 */
export default function ChromeSurgeryPanel({
  slot,
  catalog,
  installed,
  vendorId,
  vendorPrices = null,
  loading,
  error,
  onRetry,
  onSurgeryDone,
}: ChromeSurgeryPanelProps) {
  const character = useAuthStore((s) => s.character);
  const balance = useHudStore((s) => s.balance);
  const mountedRef = useRef(true);
  const onDoneRef = useRef(onSurgeryDone);

  const [stage, setStage] = useState<Stage>(slot ? "slot_selected" : "idle");
  const [implant, setImplant] = useState<ChromeDefinition | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    onDoneRef.current = onSurgeryDone;
  });

  // The panel is remounted per slot (key in ChromeView), so stage is fresh here.
  // The theater/done stages survive the installed refetch the parent kicks off
  // on completion (which flips `loading` back to true for a moment).
  const theaterActive = stage === "surgery_playing" || stage === "done";

  // Installed loadout failed to load (and there is no cached loadout to
  // compute surgery math from) — surface the error with a retry instead of
  // hanging on the loading spinner forever.
  if (slot && !installed && !loading && error) {
    return (
      <div role="alert" className="card space-y-3">
        <p className="text-nd-magenta text-sm font-data">
          Não foi possível carregar seu cromo. Tente novamente.
        </p>
        {onRetry && <ActionButton onClick={onRetry}>Tentar novamente</ActionButton>}
      </div>
    );
  }

  if ((loading || (slot && !installed)) && !theaterActive) {
    return <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>;
  }

  if (!slot) {
    return (
      <p className="text-nd-text-secondary text-sm font-data">
        Selecione um slot no mapa corporal para ver os cromos disponíveis.
      </p>
    );
  }

  const label = CHROME_SLOT_LABELS[slot] ?? slot;
  const inSlot = installed?.installed.filter((rec) => rec.definition.slot === slot) ?? [];
  const count = inSlot.length;
  const capacity = SLOT_CAPACITY[slot];
  const slotFull = count >= capacity;
  const catalogForSlot = catalog.filter((c) => c.slot === slot);
  /** Stock gate: when the ferrageiro's inventory is known, only implants he
   * actually carries are offered; unknown inventory (null) falls back to the
   * full slot catalog — the server stays authoritative on the charge. */
  const available = vendorPrices
    ? catalogForSlot.filter((c) => vendorPrices[c.id] !== undefined)
    : catalogForSlot;

  function isInstalled(def: ChromeDefinition): boolean {
    return inSlot.some((rec) => rec.definition.id === def.id);
  }

  function attrBefore(key: AttributeKey): number {
    return (character?.[key] ?? 0) + (installed?.statBonus[key] ?? 0);
  }

  // Overclock (feature #65) mirrors the server: metade do preço, zero de
  // humanidade na próxima instalação de cromo (consumido no uso).
  const overclockActive = isOverclockActive(character);

  /** Grana que o server vai cobrar (espelha installChrome §7): preço do
   * ferrageiro quando conhecido (fallback: basePrice do catálogo), com −50%
   * arredondado pra cima quando o Overclock está ativo. */
  function effectivePrice(def: ChromeDefinition): number {
    const base = vendorPrices?.[def.id] ?? def.basePrice;
    return overclockActive ? Math.ceil(base * 0.5) : base;
  }

  /** Custo de humanidade que o server vai aplicar (espelha installChrome §6):
   * 0 com Overclock ativo, senão o custo do cromo. */
  function effectiveHumanityCost(def: ChromeDefinition): number {
    return overclockActive ? 0 : def.humanityCost;
  }

  /**
   * Blocking reasons joined — the server re-validates everything on install
   * (including available funds = balance − escrow, which the client HUD does
   * not track).
   */
  function blockReason(def: ChromeDefinition): string | null {
    if (!installed) return null;
    const reasons: string[] = [];
    if (!vendorId) reasons.push("Nenhum ferrageiro disponível. Visite a aba Vendedores.");
    if (slotFull) reasons.push("Slot cheio.");
    if (balance !== null && balance < effectivePrice(def)) reasons.push("Grana insuficiente.");
    if (installed.effectiveHumanity - effectiveHumanityCost(def) < 0) reasons.push("Humanidade insuficiente.");
    return reasons.length ? reasons.join(" ") : null;
  }

  async function onConfirm() {
    if (!implant || !vendorId) return;
    setActionError(null);
    setStage("confirming");
    try {
      await api.post("/api/chrome/install", { chromeDefinitionId: implant.id, vendorId });
      if (!mountedRef.current) return;
      setStage("surgery_playing");
    } catch (e) {
      if (!mountedRef.current) return;
      setActionError(e instanceof Error ? e.message : "Falha ao instalar");
      setStage("reviewing");
    }
  }

  // Surgery theater timer: ~5s, then the parent reloads installed + HUD.
  useEffect(() => {
    if (stage !== "surgery_playing") return;
    const timer = window.setTimeout(
      () => {
        if (!mountedRef.current) return;
        setStage("done");
        onDoneRef.current();
      },
      prefersReducedMotion() ? 0 : SURGERY_MS,
    );
    return () => window.clearTimeout(timer);
  }, [stage]);

  function backToPicker() {
    setImplant(null);
    setActionError(null);
    setStage("slot_selected");
  }

  // ── done ───────────────────────────────────────────────────────────────────
  if (stage === "done" && implant) {
    return (
      <div role="status" className="card space-y-3">
        <p className="text-nd-green font-data text-sm">✓ Cirurgia concluída. Cromo instalado: {implant.name}.</p>
        <p className="text-nd-text-secondary font-data text-xs">
          O cromo é seu. A conta de humanidade, também.
        </p>
        <ActionButton onClick={backToPicker}>Concluir</ActionButton>
      </div>
    );
  }

  // ── surgery_playing ────────────────────────────────────────────────────────
  if (stage === "surgery_playing" && implant && installed) {
    const projectedHumanity = installed.effectiveHumanity - effectiveHumanityCost(implant);
    return (
      <div role="status" className="card border-nd-magenta/20 space-y-3">
        <p className="font-data text-xs text-nd-magenta animate-pulse-neon tracking-widest">
          /// BATIMENTO NEURAL ///
        </p>
        <TypewriterText text={SURGERY_LOG} className="font-data text-sm text-nd-text-secondary" />
        <div className="animate-pulse-neon">
          <MetricBar resource="humanity" value={projectedHumanity} label="Humanidade" />
        </div>
        <ActionButton
          variant="danger"
          status="cooldown"
          cooldownRemainingS={prefersReducedMotion() ? 0 : SURGERY_MS / 1000}
          cooldownLabel="ferro esfriando"
        >
          Operando
        </ActionButton>
      </div>
    );
  }

  // ── slot_selected ──────────────────────────────────────────────────────────
  if (stage === "slot_selected" || !implant) {
    return (
      <div className="card space-y-3">
        <h3 className="font-heading text-nd-cyan">{label}</h3>
        <p className="text-nd-text-secondary text-xs font-data">
          {count}/{capacity} ocupados
        </p>
        {catalogForSlot.length === 0 ? (
          <p className="text-nd-text-secondary text-sm font-data">Nenhum cromo para este slot.</p>
        ) : available.length === 0 ? (
          <p className="text-nd-text-secondary text-sm font-data">
            O ferrageiro não tem cromo em estoque para este slot.
          </p>
        ) : (
          <ul className="space-y-2">
            {available.map((def) => {
              const already = isInstalled(def);
              return (
                <li key={def.id}>
                  <button
                    type="button"
                    className="card w-full text-left hover:border-nd-cyan/50 transition-colors"
                    disabled={already}
                    aria-disabled={already || undefined}
                    onClick={() => {
                      setImplant(def);
                      setActionError(null);
                      setStage("reviewing");
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-heading text-nd-cyan text-sm">{def.name}</span>
                      <span className="font-data text-xs text-nd-gold">{formatEds(effectivePrice(def))}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-data text-[11px] text-nd-text-secondary">
                        Tier {def.tier} · -{effectiveHumanityCost(def)} humanidade
                      </span>
                      {already && <span className="font-data text-[11px] text-nd-text-secondary">(instalado)</span>}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    );
  }

  // ── reviewing ──────────────────────────────────────────────────────────────
  const before = {
    hp: installed?.hpBonus ?? 0,
    nil: installed?.nilMaxBonus ?? 0,
    gig: installed?.gigSuccessBonus ?? 0,
    humanity: installed?.effectiveHumanity ?? 0,
  };
  const bonus = implant.bonuses;
  const blocked = blockReason(implant);
  const price = effectivePrice(implant);
  const humanityCost = effectiveHumanityCost(implant);

  return (
    <div className="card space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-heading text-nd-cyan">{implant.name}</h3>
        <button type="button" className="text-nd-text-secondary text-[11px] font-data underline" onClick={backToPicker}>
          trocar
        </button>
      </div>
      {implant.description && <p className="text-nd-text-secondary text-xs">{implant.description}</p>}

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs font-data">
        <p className="text-nd-gold">Custo: {formatEds(price)}</p>
        <p className="text-nd-magenta">-{humanityCost} humanidade</p>
        {overclockActive && (
          <p className="text-nd-purple">Overclock ativo: metade do preço, zero de humanidade.</p>
        )}
      </div>

      <div className="border-t border-nd-cyan/10 pt-2 space-y-1 text-xs font-data">
        <p className="text-nd-text-secondary uppercase tracking-widest text-[10px]">Antes → Depois</p>
        {ATTR_KEYS.map((key) => {
          const from = attrBefore(key);
          const to = from + (bonus[key] ?? 0);
          const changed = to !== from;
          return (
            <div key={key} className="flex justify-between gap-2">
              <span className="text-nd-text-secondary">{ATTRIBUTE_LABELS[key]}</span>
              <span className={changed ? "text-nd-gold" : "text-nd-text"}>
                {from} → {to}
                {changed ? " ▲" : ""}
              </span>
            </div>
          );
        })}
        <div className="flex justify-between gap-2">
          <span className="text-nd-text-secondary">Bônus HP</span>
          <span className="text-nd-text">
            +{before.hp} → +{before.hp + (bonus.max_hp ?? 0)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-nd-text-secondary">NIL máx.</span>
          <span className="text-nd-text">
            +{before.nil} → +{before.nil + (bonus.nil_max ?? 0)}
          </span>
        </div>
        <div className="flex justify-between gap-2">
          <span className="text-nd-text-secondary">Sucesso em trampos</span>
          <span className="text-nd-text">
            +{before.gig}% → +{before.gig + (bonus.gig_success_rate ?? 0)}%
          </span>
        </div>
        <div className="pt-1">
          <p className="text-nd-text-secondary pb-1">
            Humanidade: <span className="text-nd-text">{before.humanity}</span>
            <span className="text-nd-magenta"> → {before.humanity - humanityCost}</span>
          </p>
          <MetricBar resource="humanity" value={before.humanity - humanityCost} label="Humanidade pós-cirurgia" />
        </div>
      </div>

      {blocked ? (
        <ActionButton status="blocked" blockReason={blocked}>
          Confirmar cirurgia
        </ActionButton>
      ) : (
        <ActionButton
          status={stage === "confirming" ? "loading" : actionError ? "error" : "default"}
          errorMessage={actionError ?? undefined}
          onClick={() => void onConfirm()}
        >
          Confirmar cirurgia
        </ActionButton>
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import type { AttributeKey, ChromeDefinition, ChromeSlot, InstalledChromeResponse } from "@neon-dusk/shared";
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
  /** True while the parent is still loading catalog/installed. */
  loading: boolean;
  /** Fired once the surgery theater finishes — parent reloads installed + HUD. */
  onSurgeryDone: () => void;
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
  loading,
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
  const available = catalog.filter((c) => c.slot === slot);

  function isInstalled(def: ChromeDefinition): boolean {
    return inSlot.some((rec) => rec.definition.id === def.id);
  }

  function attrBefore(key: AttributeKey): number {
    return (character?.[key] ?? 0) + (installed?.statBonus[key] ?? 0);
  }

  /** Blocking reasons joined — the server re-validates everything on install. */
  function blockReason(def: ChromeDefinition): string | null {
    if (!installed) return null;
    const reasons: string[] = [];
    if (!vendorId) reasons.push("Nenhum ferrageiro disponível. Visite a aba Vendedores.");
    if (slotFull) reasons.push("Slot cheio.");
    if (balance !== null && balance < def.basePrice) reasons.push("Grana insuficiente.");
    if (installed.effectiveHumanity - def.humanityCost < 0) reasons.push("Humanidade insuficiente.");
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
    const projectedHumanity = installed.effectiveHumanity - implant.humanityCost;
    return (
      <div role="status" aria-live="polite" className="card border-nd-magenta/20 space-y-3">
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
        {available.length === 0 ? (
          <p className="text-nd-text-secondary text-sm font-data">Nenhum cromo para este slot.</p>
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
                      <span className="font-data text-xs text-nd-gold">{formatEds(def.basePrice)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-1">
                      <span className="font-data text-[11px] text-nd-text-secondary">
                        Tier {def.tier} · -{def.humanityCost} humanidade
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
        <p className="text-nd-gold">Custo: {formatEds(implant.basePrice)}</p>
        <p className="text-nd-magenta">-{implant.humanityCost} humanidade</p>
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
            <span className="text-nd-magenta"> → {before.humanity - implant.humanityCost}</span>
          </p>
          <MetricBar resource="humanity" value={before.humanity - implant.humanityCost} label="Humanidade pós-cirurgia" />
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

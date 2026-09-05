import { useEffect, useRef, useState } from "react";
import type {
  PvpTarget,
  PvpCombatRecord,
  PvpCombatResult,
  PvpAttackableResponse,
  PvpHistoryResponse,
} from "@neon-dusk/shared";
import { api } from "@/api/client";
import { useHudStore } from "@/stores/hud";
import { useStreetCredStore } from "@/stores/street-cred";
import Tab from "@/components/ui/Tab";
import AttackConfirmModal from "@/components/pvp/AttackConfirmModal";
import CombatResultModal from "@/components/pvp/CombatResultModal";

type TabKey = "targets" | "history";

/**
 * PvP arena — scan for attackable targets and review your combat history.
 * The attack flow is confirm-first: picking a target opens the confirmation
 * modal (mirrored cards + NIL cost + risks), confirming POSTs the attack and
 * the result modal shows the combat log.
 */
export default function PvpView() {
  const mountedRef = useRef(true);
  const [tab, setTab] = useState<TabKey>("targets");

  // Targets
  const [targets, setTargets] = useState<PvpTarget[]>([]);
  const [nilCost, setNilCost] = useState(0);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  // History
  const [combats, setCombats] = useState<PvpCombatRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Attack flow
  const [confirmTarget, setConfirmTarget] = useState<PvpTarget | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [combatResult, setCombatResult] = useState<PvpCombatResult | null>(null);

  async function fetchTargets() {
    setTargetsLoading(true);
    setTargetsError(null);
    try {
      const res = await api.get<PvpAttackableResponse>("/api/pvp/attackable");
      if (!mountedRef.current) return;
      setTargets(res.targets);
      setNilCost(res.nilCost);
    } catch (e) {
      if (!mountedRef.current) return;
      setTargetsError(e instanceof Error ? e.message : "Falha ao carregar alvos");
    } finally {
      if (mountedRef.current) setTargetsLoading(false);
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const res = await api.get<PvpHistoryResponse>("/api/pvp/history");
      if (!mountedRef.current) return;
      setCombats(res.combats);
      setNextCursor(res.nextCursor);
    } catch (e) {
      if (!mountedRef.current) return;
      setHistoryError(e instanceof Error ? e.message : "Falha ao carregar histórico");
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }

  useEffect(() => {
    mountedRef.current = true;
    fetchTargets();
    fetchHistory();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function openConfirm(target: PvpTarget) {
    setActionError(null);
    setConfirmTarget(target);
  }

  async function confirmAttack() {
    if (!confirmTarget) return;
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await api.post<PvpCombatResult>("/api/pvp/attack", {
        targetId: confirmTarget.characterId,
      });
      if (!mountedRef.current) return;
      setConfirmTarget(null);
      setCombatResult(res);
      fetchTargets();
      // Attack moves grana and Moral — keep the HUD readouts honest (issue #13).
      void useHudStore.getState().refresh();
      void useStreetCredStore.getState().fetchSC();
    } catch (e) {
      if (!mountedRef.current) return;
      setActionError(e instanceof Error ? e.message : "Falha ao atacar");
    } finally {
      if (mountedRef.current) setActionLoading(false);
    }
  }

  return (
    <div className="py-8 space-y-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">PvP</h2>

      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <Tab state={tab === "targets" ? "active" : "inactive"} onClick={() => setTab("targets")}>
          Alvos
        </Tab>
        <Tab state={tab === "history" ? "active" : "inactive"} onClick={() => setTab("history")}>
          Histórico
        </Tab>
      </div>

      {tab === "targets" && (
        <div>
          {targetsLoading ? (
            <span className="text-nd-text-secondary animate-pulse-neon font-data">
              ▌ loading...
            </span>
          ) : targetsError ? (
            <p className="text-nd-magenta text-sm font-data">{targetsError}</p>
          ) : targets.length === 0 ? (
            <p className="text-nd-text-secondary text-sm font-data">Nenhum alvo disponível.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {targets.map((t) => (
                <div key={t.characterId} className="card border-nd-cyan/20">
                  <h3 className="font-heading text-nd-cyan">{t.name}</h3>
                  <div className="text-xs font-data mt-1 space-y-0.5">
                    <p className="text-nd-text-secondary">
                      M: <span className="text-nd-gold">{t.streetCred}</span>
                    </p>
                    <p className="text-nd-text-secondary">
                      Poder: <span className="text-nd-text">{t.power}</span>
                    </p>
                    {t.noobShield && <p className="text-nd-magenta">Escudo de iniciante ativo</p>}
                    {t.griefRisk && <p className="text-nd-gold">Risco de grief</p>}
                  </div>
                  <button
                    className="btn-neon text-xs px-3 py-1 mt-3"
                    disabled={actionLoading}
                    onClick={() => openConfirm(t)}
                  >
                    Atacar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "history" && (
        <div>
          {historyLoading ? (
            <span className="text-nd-text-secondary animate-pulse-neon font-data">
              ▌ loading...
            </span>
          ) : historyError ? (
            <p className="text-nd-magenta text-sm font-data">{historyError}</p>
          ) : combats.length === 0 ? (
            <p className="text-nd-text-secondary text-sm font-data">Nenhum combate registrado.</p>
          ) : (
            <div className="space-y-3">
              {combats.map((c) => (
                <div
                  key={c.id}
                  className="card border-nd-cyan/20 flex items-center justify-between gap-3"
                >
                  <div className="text-xs font-data">
                    <span className="text-nd-text">{c.attackerName}</span>
                    <span className="text-nd-text-secondary"> vs </span>
                    <span className="text-nd-text">{c.defenderName}</span>
                    <span className="text-nd-text-secondary ml-3">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-data">
                    {c.grieferPenalty && <span className="text-nd-magenta">GRIEFER</span>}
                    <span className={c.won ? "text-nd-green" : "text-nd-magenta"}>
                      {c.won ? "VITÓRIA" : "DERROTA"}
                    </span>
                    <span className="text-nd-gold">G$ {c.lootAmount}</span>
                  </div>
                </div>
              ))}
              {nextCursor && (
                <p className="text-nd-text-secondary text-xs font-data text-center">
                  Mais resultados...
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {confirmTarget && (
        <AttackConfirmModal
          target={confirmTarget}
          nilCost={nilCost}
          open
          onClose={() => setConfirmTarget(null)}
          onConfirm={() => void confirmAttack()}
          loading={actionLoading}
          error={actionError}
        />
      )}

      {combatResult && (
        <CombatResultModal result={combatResult} open onClose={() => setCombatResult(null)} />
      )}
    </div>
  );
}

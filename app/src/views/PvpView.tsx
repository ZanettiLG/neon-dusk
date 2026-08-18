import { useEffect, useRef, useState } from "react";
import type { PvpTarget, PvpCombatRecord, PvpAttackableResponse, PvpHistoryResponse } from "@neon-dusk/shared";
import { api } from "@/api/client";
import Tab from "@/components/ui/Tab";

type TabKey = "targets" | "history";

/**
 * PvP arena — scan for attackable targets and review your combat history.
 */
export default function PvpView() {
  const mountedRef = useRef(true);
  const [tab, setTab] = useState<TabKey>("targets");

  // Targets
  const [targets, setTargets] = useState<PvpTarget[]>([]);
  const [targetsLoading, setTargetsLoading] = useState(true);
  const [targetsError, setTargetsError] = useState<string | null>(null);

  // History
  const [combats, setCombats] = useState<PvpCombatRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Action
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  async function fetchTargets() {
    setTargetsLoading(true);
    setTargetsError(null);
    try {
      const res = await api.get<PvpAttackableResponse>("/api/pvp/attackable");
      if (!mountedRef.current) return;
      setTargets(res.targets);
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
    fetchTargets();
    fetchHistory();
    return () => { mountedRef.current = false; };
  }, []);

  async function onAttack(targetId: string) {
    setActionLoading(true);
    setActionError(null);
    setActionMsg(null);
    try {
      const res = await api.post<{ won: boolean; lootAmount: number }>("/api/pvp/attack", { targetId });
      if (!mountedRef.current) return;
      setActionMsg(res.won ? `Vitória! +${res.lootAmount} eds` : `Derrota! -${res.lootAmount} eds`);
      fetchTargets();
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

      {actionMsg && <p className="text-nd-green text-sm font-data">{actionMsg}</p>}
      {actionError && <p className="text-nd-magenta text-sm font-data">{actionError}</p>}

      {tab === "targets" && (
        <div>
          {targetsLoading ? (
            <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
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
                      SC: <span className="text-nd-gold">{t.streetCred}</span>
                    </p>
                    <p className="text-nd-text-secondary">
                      Poder: <span className="text-nd-text">{t.power}</span>
                    </p>
                    {t.noobShield && (
                      <p className="text-nd-magenta">Escudo de iniciante ativo</p>
                    )}
                  </div>
                  <button
                    className="btn-neon text-xs px-3 py-1 mt-3"
                    disabled={actionLoading}
                    onClick={() => void onAttack(t.characterId)}
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
            <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
          ) : historyError ? (
            <p className="text-nd-magenta text-sm font-data">{historyError}</p>
          ) : combats.length === 0 ? (
            <p className="text-nd-text-secondary text-sm font-data">Nenhum combate registrado.</p>
          ) : (
            <div className="space-y-3">
              {combats.map((c) => (
                <div key={c.id} className="card border-nd-cyan/20 flex items-center justify-between gap-3">
                  <div className="text-xs font-data">
                    <span className="text-nd-text">{c.attackerName}</span>
                    <span className="text-nd-text-secondary"> vs </span>
                    <span className="text-nd-text">{c.defenderName}</span>
                    <span className="text-nd-text-secondary ml-3">
                      {new Date(c.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-data">
                    {c.grieferPenalty && (
                      <span className="text-nd-magenta">GRIEFER</span>
                    )}
                    <span className={c.won ? "text-nd-green" : "text-nd-magenta"}>
                      {c.won ? "VITÓRIA" : "DERROTA"}
                    </span>
                    <span className="text-nd-gold">{c.lootAmount} eds</span>
                  </div>
                </div>
              ))}
              {nextCursor && (
                <p className="text-nd-text-secondary text-xs font-data text-center">Mais resultados...</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

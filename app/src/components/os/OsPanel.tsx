import { useEffect, useRef, useState } from "react";
import { useOsStore } from "@/stores/os";
import { useHudStore } from "@/stores/hud";

/**
 * OS panel (issue #28): installed OS card + activation controls. Shows the
 * daily charge counter (used/remaining), the effect window timer when active
 * and the UTC-midnight reset. Gazuá renders as inert (Fase 2). The OS is
 * installed via the cromo surgery flow — this panel only activates.
 */
export default function OsPanel() {
  const mountedRef = useRef(true);
  const status = useOsStore((s) => s.status);
  const loading = useOsStore((s) => s.loading);
  const error = useOsStore((s) => s.error);
  const fetch = useOsStore((s) => s.fetch);
  const activate = useOsStore((s) => s.activate);

  const [actionError, setActionError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  // Live countdown of the active effect window — ticks every second while
  // the OS is active (issue #28 review, cycle 2: the old render-time
  // computation never updated).
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    void fetch();
    return () => { mountedRef.current = false; };
  }, [fetch]);

  useEffect(() => {
    const activeUntil = status?.ability?.isActive ? status.ability.activeUntil : null;
    if (!activeUntil) {
      setSecondsLeft(0);
      return;
    }
    const tick = () => {
      setSecondsLeft(Math.max(0, Math.ceil((new Date(activeUntil).getTime() - Date.now()) / 1000)));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.ability?.isActive, status?.ability?.activeUntil]);

  async function onActivate() {
    setActionError(null);
    setActionSuccess(null);
    try {
      const result = await activate();
      if (!mountedRef.current) return;
      setActionSuccess(result.message);
      // Humanity/grana readouts don't move here, but keep the HUD OS cell fresh.
      void useHudStore.getState().refresh();
    } catch (e) {
      if (!mountedRef.current) return;
      setActionError(e instanceof Error ? e.message : "Falha ao ativar o SO");
    }
  }

  if (loading && !status) {
    return (
      <div className="card space-y-2" aria-busy="true">
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div role="alert" className="card">
        <p className="text-nd-magenta text-sm font-data">{error}</p>
        <button type="button" className="btn-neon text-xs px-3 py-1 mt-3" onClick={() => void fetch()}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!status || !status.installed || !status.os || !status.ability) {
    return (
      <div className="card text-center py-8">
        <p className="text-nd-text-secondary font-data text-sm">
          Nenhum SO instalado. Visite o Doc Fios e escolha seu build na cirurgia
          (aba Corpo → Sistema Operacional).
        </p>
      </div>
    );
  }

  const { os, ability } = status;

  return (
    <div className="card border-nd-cyan/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-heading text-nd-cyan tracking-widest text-lg">{os.name}</span>
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary">
          SO · permanente por rodada
        </span>
      </div>

      {ability.inert ? (
        <p className="text-nd-text-secondary text-sm font-data">
          SO inerte nesta rodada: habilidade chega na Fase 2. Escolha de build ainda vale.
        </p>
      ) : (
        <div className="space-y-2 text-xs font-data">
          <p className="text-nd-text-secondary">
            Ativações hoje:{" "}
            <span className="text-nd-text">
              {ability.usedToday}/{ability.maxUsesPerDay}
            </span>{" "}
            · restam <span className="text-nd-gold">{ability.usesRemaining}</span>
          </p>
          <p className="text-nd-text-secondary">
            Duração: <span className="text-nd-text">{ability.durationSeconds}s</span> · reset diário:{" "}
            <span className="text-nd-text">
              {new Date(ability.resetsAt).toLocaleTimeString("pt-BR", { timeZone: "UTC" })} UTC
            </span>
          </p>
          {ability.isActive && (
            <p className="text-nd-green">
              Efeito ativo — encerra em {secondsLeft}s.
            </p>
          )}
          <button
            type="button"
            className="btn-neon text-xs px-3 py-1 mt-2"
            disabled={loading || ability.isActive || ability.usesRemaining <= 0}
            onClick={() => void onActivate()}
          >
            {ability.isActive
              ? "Efeito ativo"
              : ability.usesRemaining <= 0
                ? "Sem ativações hoje"
                : "Ativar"}
          </button>
        </div>
      )}

      {actionSuccess && <p className="text-nd-green text-sm font-data">{actionSuccess}</p>}
      {actionError && <p className="text-nd-magenta text-sm font-data">{actionError}</p>}
    </div>
  );
}
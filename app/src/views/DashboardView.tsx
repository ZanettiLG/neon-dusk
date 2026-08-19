import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AttributeKey,
  CharacterEvent,
  CharacterEventsResponse,
  InstalledChromeResponse,
  RoundInfoResponse,
  RoundStatus,
} from "@neon-dusk/shared";
import { ATTRIBUTE_KEYS, BASE_ATTRIBUTES, SOFT_CAP } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { ATTRIBUTE_LABELS, ORIGIN_LABELS, ROLE_LABELS } from "@/lib/labels";
import { formatCountdown } from "@/lib/format";
import { api } from "@/api/client";
import Leaderboard from "@/components/Leaderboard";
import CharacterAvatar from "@/components/CharacterAvatar";
import ResourceBar from "@/components/ResourceBar";
import ChromeBodyMap from "@/components/ChromeBodyMap";
import EventLog from "@/components/ui/EventLog";
import type { EventLogEntry } from "@/components/ui/types";
import QuickActions from "@/components/QuickActions";
import { formatEventMessage } from "@/lib/events";

/** Translate round status to Portuguese display label. */
const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  active: "ATIVO",
  ended: "ENCERRADO",
  intermission: "INTERVALO",
};

/**
 * Runner dashboard: character card (avatar, attributes), NIL bar with live
 * regen countdown, Pingado (ampola), humanity + cromo body map, recent event
 * feed, quick actions, leaderboard and logout (port of DashboardView.vue).
 */
export default function DashboardView() {
  const navigate = useNavigate();
  const character = useAuthStore((s) => s.character);
  const user = useAuthStore((s) => s.user);
  const nilStatus = useAuthStore((s) => s.nilStatus);
  const nilLoading = useAuthStore((s) => s.nilLoading);
  const nilError = useAuthStore((s) => s.nilError);
  const fetchNil = useAuthStore((s) => s.fetchNil);
  const useStim = useAuthStore((s) => s.useStim);
  const logout = useAuthStore((s) => s.logout);

  const attributeHighlight = (key: AttributeKey) =>
    (character?.[key] ?? 0) >= SOFT_CAP
      ? "text-nd-magenta"
      : (character?.[key] ?? 0) > BASE_ATTRIBUTES
        ? "text-nd-cyan"
        : "text-nd-text";

  // --- NIL (Feature #2) — live regen countdown ----------------------------------

  const [countdown, setCountdown] = useState(0);
  const countdownTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // --- Humanity + chrome body map (Feature #139) --------------------------------

  const [installed, setInstalled] = useState<InstalledChromeResponse | null>(null);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [installedError, setInstalledError] = useState<string | null>(null);

  // --- Recent event feed (Feature #139) -----------------------------------------

  const [events, setEvents] = useState<CharacterEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [roundInfo, setRoundInfo] = useState<RoundInfoResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<RoundInfoResponse>("/api/round");
        if (!cancelled) setRoundInfo(data);
      } catch {
        // Round info unavailable — keep the null state which shows nothing.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Humanity + body map come from the single /api/chrome/installed fetch.
  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<InstalledChromeResponse>("/api/chrome/installed");
        if (!cancelled) setInstalled(data);
      } catch {
        if (!cancelled) setInstalledError("Humanidade indisponível");
      } finally {
        if (!cancelled) setInstalledLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [character]);

  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await api.get<CharacterEventsResponse>("/api/characters/me/events");
        if (!cancelled) setEvents(data.events ?? []);
      } catch {
        if (!cancelled) setEventsError("Falha ao carregar eventos");
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [character]);

  function syncCountdown(): void {
    setCountdown(useAuthStore.getState().nilStatus?.nextTickSeconds ?? 0);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await fetchNil();
      if (cancelled) return;
      syncCountdown();
      countdownTimer.current = setInterval(() => {
        setCountdown((prev) => {
          if (prev > 0) return prev - 1;
          // Regen tick landed — refresh to display the accrued NIL.
          const nil = useAuthStore.getState().nilStatus;
          if (nil?.regenerating) {
            void useAuthStore.getState().fetchNil();
            return nil.nextTickSeconds;
          }
          return prev;
        });
      }, 1000);
    })();
    return () => {
      cancelled = true;
      if (countdownTimer.current) {
        clearInterval(countdownTimer.current);
        countdownTimer.current = null;
      }
    };
  }, [fetchNil]);

  async function onUseStim(): Promise<void> {
    try {
      await useStim();
      syncCountdown();
    } catch {
      // error already surfaced through nilError
    }
  }

  async function onLogout(): Promise<void> {
    await logout();
    navigate("/login");
  }

  const nilEtaText = nilStatus?.regenerating
    ? `Próximo +1 em ${formatCountdown(countdown)}`
    : "NIL CHEIO";

  // Map CharacterEvent[] → EventLogEntry[] for the shared ui/EventLog (#134).
  const eventEntries: EventLogEntry[] = events.map((e) => ({
    id: e.id,
    severity: e.severity,
    title: formatEventMessage(e.eventType, e.payload),
    timestamp: e.createdAt,
  }));

  return (
    <div className="py-8 space-y-6">
      {/* Session header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">PAINEL DO CORREDOR</h2>
          <p className="text-nd-text-secondary text-sm">
            Conectado como <span className="font-data text-nd-text">{user?.email}</span>
          </p>
        </div>
        <button className="btn-danger text-xs self-start" onClick={() => void onLogout()}>
          Desconectar
        </button>
      </div>

      {character ? (
        <>
          <div className="card space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex items-start gap-3">
                <CharacterAvatar origin={character.origin} size="md" />
                <div>
                  <h3 className="font-heading text-3xl text-nd-gold">{character.name}</h3>
                  <p className="text-nd-text-secondary font-data text-sm mt-1">
                    {ROLE_LABELS[character.role]} · Origem: {ORIGIN_LABELS[character.origin]}
                  </p>
                </div>
              </div>
              {roundInfo && (
                <span className="self-start font-data text-xs uppercase tracking-widest border border-nd-cyan/40 text-nd-cyan rounded-terminal px-2 py-1">
                  ROUND {roundInfo.roundNumber} // {ROUND_STATUS_LABEL[roundInfo.status]}
                </span>
              )}
            </div>

            {/* NIL — neural load bar (Feature #2) */}
            {nilStatus ? (
              <>
                <ResourceBar
                  resource="nil"
                  label="NIL // CARGA NEURAL"
                  value={nilStatus.current}
                  max={nilStatus.max}
                  etaText={nilEtaText}
                  action={
                    <div className="flex flex-col items-end gap-1">
                      <button
                        className="btn-neon text-xs px-3 py-1"
                        disabled={nilLoading || !nilStatus.regenerating}
                        onClick={() => void onUseStim()}
                      >
                        PINGADO
                      </button>
                      <span className="text-[10px] font-data text-nd-text-secondary">
                        Brinde gratuito — 1h cooldown
                      </span>
                    </div>
                  }
                />
                {nilError && <span className="text-nd-magenta text-xs font-data">{nilError}</span>}
              </>
            ) : nilLoading || !nilError ? (
              <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
            ) : (
              <p className="text-nd-magenta text-sm font-data">NIL indisponível</p>
            )}

            {/* Humanidade + chrome body map (Feature #139) */}
            <div className="space-y-2">
              <h4 className="font-data text-xs uppercase tracking-widest text-nd-text-secondary">
                HUMANIDADE // CROMO
              </h4>
              {installedLoading ? (
                <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
              ) : installedError ? (
                <p className="text-nd-magenta text-sm font-data">{installedError}</p>
              ) : (
                <>
                  <ResourceBar
                    resource="humanity"
                    label="HUMANIDADE"
                    value={installed?.effectiveHumanity ?? 100}
                    max={100}
                  />
                  {(installed?.installed ?? []).length === 0 ? (
                    <p className="text-nd-text-secondary text-sm font-data">Nenhum cromo instalado</p>
                  ) : (
                    <ChromeBodyMap installed={installed?.installed ?? []} />
                  )}
                </>
              )}
            </div>

            {/* Recent event feed (Feature #139) */}
            <div className="space-y-2">
              <h4 className="font-data text-xs uppercase tracking-widest text-nd-text-secondary">
                REGISTRO DE EVENTOS
              </h4>
              {eventsLoading ? (
                <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
              ) : eventsError ? (
                <p className="text-nd-magenta text-sm font-data">{eventsError}</p>
              ) : (
                <EventLog events={eventEntries} emptyMessage="Nenhum evento recente." />
              )}
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {ATTRIBUTE_KEYS.map((key) => (
                  <div
                    key={key}
                    className={`bg-nd-bg/60 border rounded-terminal p-3 text-center transition-colors ${
                      character[key] >= SOFT_CAP
                        ? "border-nd-gold/40 shadow-neon-gold"
                        : "border-nd-cyan/20"
                    }`}
                  >
                    <div className="text-nd-text-secondary text-xs font-data uppercase tracking-wider">
                      {ATTRIBUTE_LABELS[key]}
                    </div>
                    <div className={`font-data text-3xl mt-1 ${attributeHighlight(key)}`}>
                      {character[key]}
                    </div>
                    {character[key] >= SOFT_CAP && (
                      <div className="text-nd-gold/60 text-[10px] font-data mt-1 leading-tight" title="Após 15, cada ponto custa 2">
                        SOFT CAP
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <QuickActions />

          <p className="text-nd-text-secondary text-xs font-data">
            <Link to="/gigs" className="text-nd-purple hover:text-nd-cyan transition-colors">
              ▸ Quadro de trampos — Cupim, o Porteiro
            </Link>
          </p>

          <Leaderboard />
        </>
      ) : (
        <div className="card text-center space-y-3">
          <p className="text-nd-text-secondary">Nenhum personagem vinculado a esta conta.</p>
          <Link to="/create-character" className="btn-neon">
            Criar personagem
          </Link>
        </div>
      )}
    </div>
  );
}

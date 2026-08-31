import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type {
  AttributeKey,
  Character,
  CharacterEvent,
  CharacterEventsResponse,
  InstalledChromeResponse,
  RoundInfoResponse,
  RoundStatus,
} from "@neon-dusk/shared";
import { ATTRIBUTE_KEYS, BASE_ATTRIBUTES, SOFT_CAP } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { ATTRIBUTE_LABELS, ORIGIN_LABELS, ROLE_LABELS } from "@/lib/labels";
import { api } from "@/api/client";
import Leaderboard from "@/components/Leaderboard";
import CharacterAvatar from "@/components/CharacterAvatar";
import ChromeBodyMap from "@/components/ChromeBodyMap";
import EventLog from "@/components/ui/EventLog";
import type { EventLogEntry } from "@/components/ui/types";
import { ErrorState, LoadingState, MetricBar, Panel } from "@/components/ui";
import { formatEventMessage } from "@/lib/events";
import NilWidget from "@/components/dashboard/NilWidget";
import MoralWidget from "@/components/dashboard/MoralWidget";
import FundsWidget from "@/components/dashboard/FundsWidget";
import ActiveGigWidget from "@/components/dashboard/ActiveGigWidget";
import QuickActionsWidget from "@/components/dashboard/QuickActionsWidget";

/** Translate round status to Portuguese display label. */
const ROUND_STATUS_LABEL: Record<RoundStatus, string> = {
  active: "ATIVO",
  ended: "ENCERRADO",
  intermission: "INTERVALO",
};

/** Attribute value color: magenta past soft cap, cyan past base, default otherwise. */
function attributeHighlight(character: Character | null, key: AttributeKey): string {
  const value = character?.[key] ?? 0;
  if (value >= SOFT_CAP) return "text-nd-magenta";
  if (value > BASE_ATTRIBUTES) return "text-nd-cyan";
  return "text-nd-text";
}

/**
 * Identity panel: avatar, codinome, banca · origem and the live round badge
 * (GET /api/round, best-effort — a failure simply hides the badge).
 */
function IdentityPanel() {
  const character = useAuthStore((s) => s.character);
  const [roundInfo, setRoundInfo] = useState<RoundInfoResponse | null>(null);

  useEffect(() => {
    if (!character) return;
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
  }, [character]);

  if (!character) return null;

  const roundStatus = roundInfo ? ROUND_STATUS_LABEL[roundInfo.status] : null;

  return (
    <Panel>
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
        {roundInfo && roundStatus && (
          <span className="self-start font-data text-xs uppercase tracking-widest border border-nd-cyan/40 text-nd-cyan rounded-terminal px-2 py-1">
            ROUND {roundInfo.roundNumber} // {roundStatus}
          </span>
        )}
      </div>
    </Panel>
  );
}

/** Five attribute cells with soft-cap highlight (issue #56 — kept from the legacy card). */
function AttributesPanel() {
  const character = useAuthStore((s) => s.character);
  if (!character) return null;

  return (
    <Panel title="ATRIBUTOS">
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
            <div className={`font-data text-3xl mt-1 ${attributeHighlight(character, key)}`}>
              {character[key]}
            </div>
            {character[key] >= SOFT_CAP && (
              <div
                className="text-nd-gold/60 text-nd-micro font-data mt-1 leading-tight"
                title="Após 15, cada ponto custa 2"
              >
                SOFT CAP
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/**
 * Humanidade + cromo body map. Humanity prefers the band-aware HUD store
 * readout (GET /api/humanity) and falls back to the cromo snapshot; the body
 * map comes from GET /api/chrome/installed (best-effort fetch).
 */
function HumanityChromePanel() {
  const character = useAuthStore((s) => s.character);
  const hudHumanity = useHudStore((s) => s.humanity);
  const [installed, setInstalled] = useState<InstalledChromeResponse | null>(null);
  const [installedLoading, setInstalledLoading] = useState(true);
  const [installedError, setInstalledError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    setInstalledLoading(true);
    setInstalledError(null);
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
  }, [character, retryKey]);

  const humanity = hudHumanity ?? installed?.effectiveHumanity ?? null;

  return (
    <Panel title="HUMANIDADE // CROMO">
      <div className="space-y-4">
        {humanity !== null ? (
          <MetricBar resource="humanity" value={humanity} max={100} label="Humanidade" />
        ) : (
          <LoadingState variant="inline" label="humanidade" />
        )}
        {installedLoading ? (
          <LoadingState variant="inline" label="cromo" />
        ) : installedError ? (
          <ErrorState message={installedError} onRetry={() => setRetryKey((k) => k + 1)} />
        ) : (installed?.installed ?? []).length === 0 ? (
          <p className="text-nd-text-secondary text-sm font-data">Nenhum cromo instalado</p>
        ) : (
          <ChromeBodyMap installed={installed?.installed ?? []} />
        )}
      </div>
    </Panel>
  );
}

/** Recent character event feed (GET /api/characters/me/events, best-effort). */
function EventsPanel() {
  const character = useAuthStore((s) => s.character);
  const [events, setEvents] = useState<CharacterEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!character) return;
    let cancelled = false;
    setEventsLoading(true);
    setEventsError(null);
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
  }, [character, retryKey]);

  const eventEntries: EventLogEntry[] = events.map((e) => ({
    id: e.id,
    severity: e.severity,
    title: formatEventMessage(e.eventType, e.payload),
    timestamp: e.createdAt,
  }));

  return (
    <Panel
      title="REGISTRO DE EVENTOS"
      status={eventsLoading ? "loading" : eventsError ? "error" : "default"}
      errorMessage="Falha ao carregar eventos"
      onRetry={() => setRetryKey((k) => k + 1)}
    >
      <EventLog events={eventEntries} emptyMessage="Nenhum evento recente." />
    </Panel>
  );
}

/**
 * Corredor dashboard: composition shell over the design-system widgets (NIL,
 * Moral, Grana, Trampo ativo, Ações rápidas) plus the identity header, attribute
 * grid, humanity/cromo, event feed and leaderboard. Every widget fetches its own
 * data best-effort — one failure never takes the panel down (issue #56).
 */
export default function DashboardView() {
  const navigate = useNavigate();
  const character = useAuthStore((s) => s.character);
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  async function onLogout(): Promise<void> {
    await logout();
    navigate("/login");
  }

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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div className="md:col-span-2 xl:col-span-3">
              <IdentityPanel />
            </div>
            <NilWidget />
            <MoralWidget />
            <FundsWidget />
            <ActiveGigWidget />
            <QuickActionsWidget />
            <EventsPanel />
            <div className="md:col-span-2 xl:col-span-3">
              <AttributesPanel />
            </div>
            <div className="md:col-span-2 xl:col-span-3">
              <HumanityChromePanel />
            </div>
          </div>

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

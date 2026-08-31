import { useEffect } from "react";
import { Link } from "react-router-dom";
import type { GigPhase, GigType } from "@neon-dusk/shared";
import { useGigStore } from "@/stores/gig";
import { GIG_PHASE_LABELS, GIG_TYPE_LABELS } from "@/lib/labels";
import { EmptyState, Panel, StatusBadge } from "@/components/ui";

/**
 * Trampo ativo dashboard widget: the current 5-phase run (tier · type badge,
 * name, phase) with a shortcut back to the quadro. Fetches GET /api/gigs/active
 * on mount (store-level no-op without a character); a failure only breaks this
 * widget, never the panel.
 */
export default function ActiveGigWidget() {
  const activeGig = useGigStore((s) => s.activeGig);
  const loading = useGigStore((s) => s.activeGigLoading);
  const error = useGigStore((s) => s.activeGigError);
  const fetchActiveGig = useGigStore((s) => s.fetchActiveGig);

  // Fetch on every mount: the widget always wants the freshest readout, and a
  // successful response is legitimately `null` (no active trampo), so a
  // "fetched yet?" guard cannot work — unconditional mount fetch it is
  // (StrictMode double-mount = two GETs, same as the legacy fetchNil pattern).
  useEffect(() => {
    void fetchActiveGig();
  }, [fetchActiveGig]);

  const typeLabel = activeGig
    ? (GIG_TYPE_LABELS[activeGig.gigType as GigType] ?? activeGig.gigType.toUpperCase())
    : "";
  const phaseLabel = activeGig
    ? (GIG_PHASE_LABELS[activeGig.phase as GigPhase] ?? activeGig.phase)
    : "";

  return (
    <Panel
      title="TRAMPO ATIVO"
      status={loading ? "loading" : error && !activeGig ? "error" : "default"}
      errorMessage="Falha ao carregar trampo ativo"
      onRetry={() => void fetchActiveGig()}
    >
      {activeGig ? (
        <div className="space-y-3">
          <StatusBadge
            tone="hack"
            label={`${activeGig.gigTier.toUpperCase()} · ${typeLabel.toUpperCase()}`}
          />
          <h4 className="font-heading text-lg text-nd-text">{activeGig.gigName}</h4>
          <p className="font-data text-xs uppercase tracking-widest text-nd-text-secondary">
            Fase: <span className="text-nd-cyan">{phaseLabel.toUpperCase()}</span>
          </p>
          <Link to="/gigs" className="chip-tap btn-neon w-full justify-between">
            <span>Continuar</span>
            <span aria-hidden="true">▸</span>
          </Link>
        </div>
      ) : (
        <EmptyState
          message="Nenhum trampo ativo"
          action={
            <Link to="/gigs" className="chip-tap btn-neon ml-3">
              Ver quadro
            </Link>
          }
        />
      )}
    </Panel>
  );
}

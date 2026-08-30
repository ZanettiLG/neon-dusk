import type { HumanityInfo } from "@neon-dusk/shared";
import MetricBar from "@/components/ui/MetricBar";
import { BAND_LABELS } from "@/lib/labels";

interface HumanityBarProps {
  info: HumanityInfo | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

/**
 * Humanity readout panel (issue #28): MetricBar with the cyberpsychosis band
 * label, the scrubber regen status and the flatline (Apagado) terminal state.
 * Band thresholds come from the shared tokens (lib/tokens) — the server band
 * slug is only used for the label, never for color alone.
 */
export default function HumanityBar({ info, loading, error, onRetry }: HumanityBarProps) {
  if (loading && !info) {
    return (
      <div className="space-y-3" aria-busy="true">
        <MetricBar resource="humanity" value={0} label="Humanidade" status="loading" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div role="alert" className="card space-y-3">
        <p className="text-nd-magenta text-sm font-data">{error}</p>
        <button type="button" className="btn-neon text-xs px-3 py-1" onClick={onRetry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!info) return null;

  const bandLabel = BAND_LABELS[info.band] ?? info.band;
  const bandTone =
    info.band === "integro"
      ? "text-nd-green"
      : info.band === "instavel"
        ? "text-nd-gold"
        : info.band === "apagado"
          ? "text-nd-magenta"
          : "text-nd-magenta";

  return (
    <div className="card border-nd-cyan/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-heading text-nd-cyan tracking-widest text-lg">HUMANIDADE</span>
        <span className={`font-data text-xs uppercase tracking-widest ${bandTone}`}>
          {bandLabel}
        </span>
      </div>

      <MetricBar resource="humanity" value={info.humanity} max={100} label="Humanidade" />

      <p className="text-nd-text-secondary text-xs font-data">
        Banda: <span className="text-nd-text">{bandLabel}</span>
        {info.band === "cyberpsycho" && (
          <span className="text-nd-magenta"> — perigo máximo. Rede de segurança ativa.</span>
        )}
      </p>

      {info.flatlined && (
        <p role="alert" className="text-nd-magenta text-sm font-data border border-nd-magenta/40 rounded-terminal px-3 py-2">
          FLATLINE — personagem apagado. Perdido permanentemente; recrie na próxima rodada.
        </p>
      )}

      {info.scrubber.installed && (
        <div className="text-xs font-data text-nd-text-secondary space-y-1 border-t border-nd-cyan/10 pt-2">
          <p>
            <span className="text-nd-cyan">Lavador Neural</span> — regen passivo +1/24h (máx.{" "}
            {info.scrubber.cap})
          </p>
          {info.scrubber.pendingRegen > 0 ? (
            <p className="text-nd-green">+{info.scrubber.pendingRegen} pendentes de regen.</p>
          ) : info.scrubber.nextRegenAt ? (
            <p>
              Próximo +1 em{" "}
              {new Date(info.scrubber.nextRegenAt).toLocaleString("pt-BR")}
            </p>
          ) : (
            <p className="text-nd-text">No teto do scrubber ({info.scrubber.cap}).</p>
          )}
        </div>
      )}
    </div>
  );
}
import type { HumanityInfo, TherapyResponse, TherapyType } from "@neon-dusk/shared";
import { formatEds } from "@/lib/format";

interface TherapyPanelProps {
  info: HumanityInfo | null;
  loading: boolean;
  error: string | null;
  onTherapy: (therapyType: TherapyType) => Promise<TherapyResponse>;
}

/** Modality copy (PT-BR, diegético). */
const MODALITY_COPY: Record<TherapyType, { title: string; blurb: string }> = {
  clinic: {
    title: "Clínica",
    blurb: "Sessão cara e demorada. Restaura bastante humanidade.",
  },
  attunement: {
    title: "Sintonia",
    blurb: "Terapia alternativa, mais barata e menos eficaz.",
  },
};

/**
 * Therapy panel (issue #28): two modality cards (Clínica/Sintonia) with the
 * cost/restore ranges, a 500ms anti-spam window (#187) and per-card action
 * buttons. The server stays authoritative on cost, restore and cooldown.
 * The real limiter is the price — not time.
 */
export default function TherapyPanel({ info, loading, error, onTherapy }: TherapyPanelProps) {
  if (loading && !info) {
    return (
      <div className="space-y-3" aria-busy="true">
        <div className="card">
          <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
        </div>
      </div>
    );
  }

  if (error && !info) {
    return (
      <div role="alert" className="card">
        <p className="text-nd-magenta text-sm font-data">{error}</p>
      </div>
    );
  }

  if (!info) return null;

  const cooldownActive = info.therapy.cooldownRemainingMs > 0;
  const cooldownLabel = cooldownActive
    ? `Disponível em ${formatCountdown(info.therapy.cooldownRemainingMs)}`
    : null;

  return (
    <div className="card border-nd-cyan/20 space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-heading text-nd-cyan tracking-widest text-lg">TERAPIA</span>
        {cooldownActive && (
          <span className="font-data text-nd-micro uppercase tracking-widest text-nd-gold">
            {cooldownLabel}
          </span>
        )}
      </div>

      <p className="text-nd-text-secondary text-xs font-data">
        Anti-spam de 500ms entre sessões — o custo é o limitador real.
      </p>

      {info.flatlined && (
        <p className="text-nd-magenta text-sm font-data">
          Personagem apagado — terapia indisponível.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(["clinic", "attunement"] as const).map((type) => {
          const opt = info.therapy[type];
          const copy = MODALITY_COPY[type];
          return (
            <div key={type} className="border border-nd-cyan/15 rounded-terminal p-3 space-y-2">
              <h3 className="font-heading text-nd-cyan text-sm">{copy.title}</h3>
              <p className="text-nd-text-secondary text-xs font-data">{copy.blurb}</p>
              <p className="text-xs font-data text-nd-text">
                <span className="text-nd-gold">
                  {formatEds(opt.costMin)}–{formatEds(opt.costMax)}
                </span>{" "}
                · restaura{" "}
                <span className="text-nd-green">
                  {opt.restoreMin}–{opt.restoreMax}
                </span>
              </p>
              <button
                type="button"
                className="btn-neon text-xs px-3 py-1 w-full"
                disabled={loading || cooldownActive || info.flatlined}
                onClick={() => void onTherapy(type)}
              >
                {cooldownActive ? "Em cooldown" : `Sessão (${copy.title})`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Compact "Xd Xh Xmin" countdown label from milliseconds. */
function formatCountdown(ms: number): string {
  const totalMin = Math.ceil(ms / 60_000);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}min`);
  return parts.join(" ");
}

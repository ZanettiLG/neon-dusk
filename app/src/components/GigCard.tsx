import { useEffect, useState } from "react";
import type { GigListItem, GigType } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { ATTRIBUTE_LABELS, GIG_TYPE_LABELS } from "@/lib/labels";
import { formatCountdown } from "@/lib/format";
import { bandFor } from "@/lib/tokens";

interface GigCardProps {
  trampo: GigListItem;
  /** True while an action is in flight or another trampo is already accepted. */
  disabled: boolean;
  onAccept: (id: string) => void;
}

/** Tailwind classes per trampo type (badge + accent). */
const TYPE_STYLES: Record<GigType, { badge: string; bar: string }> = {
  extraction: { badge: "text-nd-magenta border-nd-magenta/40 bg-nd-magenta/10", bar: "bg-nd-magenta" },
  delivery: { badge: "text-nd-cyan border-nd-cyan/40 bg-nd-cyan/10", bar: "bg-nd-cyan" },
  sabotage: { badge: "text-nd-gold border-nd-gold/40 bg-nd-gold/10", bar: "bg-nd-gold" },
};

/**
 * One trampo on the Despachante Cupim board: type/tier badges, difficulty bar, reward
 * and NIL cost, per-attribute requirements (checked against the character)
 * and a live cooldown countdown.
 */
export default function GigCard({ trampo, disabled, onAccept }: GigCardProps) {
  const character = useAuthStore((s) => s.character);
  const typeStyle = TYPE_STYLES[trampo.type];

  // Live cooldown countdown (resyncs whenever the server pushes a new value).
  const [remaining, setRemaining] = useState(trampo.cooldownRemaining);
  useEffect(() => {
    setRemaining(trampo.cooldownRemaining);
    if (trampo.cooldownRemaining <= 0) return;
    const timer = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(timer);
  }, [trampo.cooldownRemaining, trampo.id]);

  const onCooldown = remaining > 0;
  const acceptDisabled = disabled || onCooldown || !trampo.meetsRequirements;

  return (
    <article className="card flex flex-col gap-3">
      {/* Header: name + badges */}
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-heading text-lg text-nd-text leading-tight">{trampo.name}</h3>
          <p className="text-nd-text-secondary text-xs font-data mt-0.5">
            {GIG_TYPE_LABELS[trampo.type]} // {trampo.district}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="font-data text-[10px] uppercase tracking-widest border rounded-terminal px-1.5 py-0.5 border-nd-green/40 text-nd-green">
            {trampo.tier.toUpperCase()}
          </span>
          <span
            className={`font-data text-[10px] uppercase tracking-widest border rounded-terminal px-1.5 py-0.5 ${typeStyle.badge}`}
          >
            {GIG_TYPE_LABELS[trampo.type]}
          </span>
        </div>
      </div>

      {/* Difficulty bar */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-[10px] font-data uppercase tracking-widest text-nd-text-secondary">
          <span>Dificuldade</span>
          <span>{trampo.difficulty}</span>
        </div>
        <div className="h-1.5 w-full bg-nd-bg rounded-full border border-nd-cyan/20 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${bandFor("gigDifficulty", trampo.difficulty).color}`}
            style={{ width: `${Math.min(100, trampo.difficulty)}%` }}
          ></div>
        </div>
      </div>

      {/* Reward + NIL cost */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-data text-sm text-nd-gold">
          G$ {trampo.baseReward.toLocaleString("pt-BR")}
        </span>
        <span className="font-data text-xs text-nd-text-secondary">
          NIL <span className="text-nd-cyan">{trampo.nilCost}</span>
        </span>
      </div>

      {/* Requirements */}
      {Object.keys(trampo.requiredStats ?? {}).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(trampo.requiredStats ?? {}).map(([key, required]) => {
            const charRecord = character as unknown as Record<string, number> | null;
            const met = (charRecord?.[key] ?? 0) >= required;
            return (
              <span
                key={key}
                className={`font-data text-[10px] uppercase tracking-wider border rounded-terminal px-1.5 py-0.5 ${
                  met
                    ? "text-nd-green border-nd-green/30"
                    : "text-nd-magenta border-nd-magenta/30"
                }`}
              >
                {met ? "✓" : "✗"}{" "}
                {ATTRIBUTE_LABELS[key as keyof typeof ATTRIBUTE_LABELS] ?? key} {required}
              </span>
            );
          })}
        </div>
      )}

      {/* Footer: cooldown + accept */}
      <div className="mt-auto flex items-center justify-between gap-2">
        {onCooldown ? (
          <span className="font-data text-[11px] text-nd-text-secondary">
            cooldown {formatCountdown(remaining)}
          </span>
        ) : !trampo.meetsRequirements ? (
          <span className="font-data text-[11px] text-nd-magenta">requisitos não atendidos</span>
        ) : (
          <span className="font-data text-[11px] text-nd-text-secondary">disponível</span>
        )}
        <button
          className="btn-neon text-xs px-3 py-1.5"
          disabled={acceptDisabled}
          onClick={() => onAccept(trampo.id)}
        >
          Aceitar
        </button>
      </div>
    </article>
  );
}

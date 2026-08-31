import { formatEds } from "@/lib/format";

export interface CombatantCardProps {
  name: string;
  power: number;
  moral: number;
  /** Live NIL readout — rendered when provided (the player's own card). */
  nil?: number;
  /** Wallet balance — rendered when provided (the player's own card). */
  balance?: number;
  /** Identity tag ("VOCÊ") for the mirrored player card. */
  tag?: "VOCÊ" | null;
  noobShield?: boolean;
  griefRisk?: boolean;
}

/**
 * Mirrored combatant card (PvP confirm modal): name, power, Moral and
 * optional NIL/balance readouts plus the noobShield/griefRisk badges. Both
 * sides of the attack use the same card so the risk reads symmetric.
 */
export default function CombatantCard({
  name,
  power,
  moral,
  nil,
  balance,
  tag = null,
  noobShield = false,
  griefRisk = false,
}: CombatantCardProps) {
  return (
    <div className="card border-nd-cyan/20">
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-heading text-nd-cyan">{name}</h3>
        {tag && (
          <span className="font-data text-nd-micro uppercase tracking-widest text-nd-gold bg-nd-gold/10 border border-nd-gold/30 rounded-terminal px-2 py-0.5">
            {tag}
          </span>
        )}
      </div>
      <div className="mt-1 space-y-0.5 text-xs font-data">
        <p className="text-nd-text-secondary">
          Poder: <span className="text-nd-text">{power}</span>
        </p>
        <p className="text-nd-text-secondary">
          M: <span className="text-nd-gold">{moral}</span>
        </p>
        {nil !== undefined && (
          <p className="text-nd-text-secondary">
            NIL: <span className="text-nd-cyan">{nil}</span>
          </p>
        )}
        {balance !== undefined && (
          <p className="text-nd-text-secondary">
            Saldo: <span className="text-nd-gold">{formatEds(balance)}</span>
          </p>
        )}
      </div>
      {(noobShield || griefRisk) && (
        <div className="mt-2 flex flex-wrap gap-1">
          {noobShield && (
            <span className="font-data text-nd-micro uppercase tracking-widest text-nd-magenta border border-nd-magenta/30 rounded-terminal px-1.5 py-0.5">
              Escudo de iniciante
            </span>
          )}
          {griefRisk && (
            <span className="font-data text-nd-micro uppercase tracking-widest text-nd-gold border border-nd-gold/30 rounded-terminal px-1.5 py-0.5">
              Risco de grief
            </span>
          )}
        </div>
      )}
    </div>
  );
}

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import CombatantCard from "@/components/pvp/CombatantCard";
import { formatEds } from "@/lib/format";
import { useAuthStore } from "@/stores/auth";
import { useHudStore } from "@/stores/hud";
import { useStreetCredStore } from "@/stores/street-cred";
import type { PvpTarget } from "@neon-dusk/shared";

/** Attack cooldown, in seconds — mirrors PVP_COOLDOWN_S in pvp-service. */
const PVP_COOLDOWN_S = 15;

export interface AttackConfirmModalProps {
  target: PvpTarget;
  /** NIL charged per attack (game param PVP_NIL_COST from the attackable list). */
  nilCost: number;
  open: boolean;
  onClose: () => void;
  /** Performs the POST /api/pvp/attack — the parent owns the request. */
  onConfirm: () => void;
  loading: boolean;
  /** API error surfaced inside the modal (ApiError.message). */
  error: string | null;
}

/**
 * PvP attack confirmation — mirrored combatant cards (VOCÊ vs target) plus
 * the NIL cost and the loss risks. The parent keeps the modal open on API
 * errors so the corredor can retry without re-picking a target.
 */
export default function AttackConfirmModal({
  target,
  nilCost,
  open,
  onClose,
  onConfirm,
  loading,
  error,
}: AttackConfirmModalProps) {
  const character = useAuthStore((s) => s.character);
  const nilCurrent = useAuthStore((s) => s.nilStatus?.current);
  const balance = useHudStore((s) => s.balance);
  const statBonus = useHudStore((s) => s.statBonus);
  const score = useStreetCredStore((s) => s.info?.score ?? null);

  // Own effective power mirrors the server's base power: body + reflexes +
  // installed-cromo combat bonus (statBonus.body + statBonus.reflexes).
  const myPower =
    character === null
      ? 0
      : character.body + character.reflexes + (statBonus?.body ?? 0) + (statBonus?.reflexes ?? 0);

  // Loss risks: 10% of the balance (or 1% loot when the target is shielded /
  // the caller is already griefing it) + 5% Moral (min 1) + the cooldown.
  const saque = target.griefRisk
    ? "saque 1% (grief)"
    : target.noobShield
      ? "saque 1%"
      : `-10% do saldo (~${formatEds(Math.floor((balance ?? 0) * 0.1))})`;
  const risk = `Risco: ${saque} · -5% Moral (mín. 1) · cooldown ${PVP_COOLDOWN_S}s`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Confirmar ataque"
      ariaLabel="Confirmar ataque"
      size="md"
    >
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <CombatantCard
          name={character?.name ?? "—"}
          power={myPower}
          moral={score ?? 0}
          nil={nilCurrent}
          balance={balance ?? undefined}
          tag="VOCÊ"
        />
        <CombatantCard
          name={target.name}
          power={target.power}
          moral={target.streetCred}
          noobShield={target.noobShield}
          griefRisk={target.griefRisk}
        />
      </div>

      <div className="mt-4 space-y-1 font-data text-xs">
        <p className="text-nd-gold">Custo: {nilCost} NIL</p>
        <p className="text-nd-text-secondary">{risk}</p>
      </div>

      {error && <p className="mt-3 font-data text-xs text-nd-magenta">{error}</p>}

      <div className="mt-4 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={loading}>
          CANCELAR
        </Button>
        <Button variant="primary" onClick={onConfirm} loading={loading}>
          CONFIRMAR ATAQUE
        </Button>
      </div>
    </Modal>
  );
}

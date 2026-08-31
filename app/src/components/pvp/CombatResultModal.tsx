import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { PvpCombatResult } from "@neon-dusk/shared";

export interface CombatResultModalProps {
  result: PvpCombatResult;
  open: boolean;
  onClose: () => void;
}

/**
 * PvP combat log modal — the outcome readout after an attack resolves:
 * VITÓRIA/DERROTA header, powers, loot (with the grief marker), Moral delta
 * and the new balance. The grief marker only applies to the attacker's own
 * loot when they were griefing the target.
 */
export default function CombatResultModal({ result, open, onClose }: CombatResultModalProps) {
  const sign = result.streetCredChange >= 0 ? "+" : "";

  return (
    <Modal open={open} onClose={onClose} ariaLabel="Resultado do combate" size="sm">
      <div className="space-y-1.5 font-data text-xs">
        <p className={`font-heading text-lg ${result.won ? "text-nd-green" : "text-nd-magenta"}`}>
          {result.won ? "VITÓRIA" : "DERROTA"}
        </p>
        <p className="text-nd-text">
          Poder: {result.attackerPower} vs {result.defenderPower}
        </p>
        <p className="text-nd-gold">
          {result.won ? "Saque" : "Perda"}: G$ {result.lootAmount}
          {result.grieferPenalty ? " (grief)" : ""}
        </p>
        <p className="text-nd-text">
          Moral: {sign}
          {result.streetCredChange} → {result.newStreetCred}
        </p>
        <p className="text-nd-text">Saldo: G$ {result.newBalance}</p>
      </div>
      <div className="mt-4 flex justify-end">
        <Button variant="primary" onClick={onClose}>
          FECHAR
        </Button>
      </div>
    </Modal>
  );
}

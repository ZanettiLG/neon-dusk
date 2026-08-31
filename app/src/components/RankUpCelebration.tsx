import { Modal } from "@/components/ui";
import { useStreetCredStore } from "@/stores/street-cred";
import { carcaraQuoteFor } from "@/components/BalcaoCard";

/**
 * Global rank-up celebration: mounted once in App (next to InstallPrompt),
 * it surfaces the title crossing detected by `fetchSC` (store.rankUp) as a
 * modal. No auto-dismiss — the corredor closes it when ready.
 */
export default function RankUpCelebration() {
  const rankUp = useStreetCredStore((s) => s.rankUp);
  const clearRankUp = useStreetCredStore((s) => s.clearRankUp);

  return (
    <Modal open={rankUp !== null} onClose={clearRankUp} ariaLabel="Rank-up de Moral" size="sm">
      {rankUp && (
        <div className="text-center space-y-3 py-2">
          <p className="font-data text-nd-micro text-nd-gold uppercase tracking-widest">
            RANK-UP // MORAL
          </p>
          <h2 className="font-heading text-3xl text-nd-gold animate-glitch">{rankUp.title}</h2>
          <p className="font-data text-xs text-nd-text">
            Moral {rankUp.score} — degrau de {rankUp.threshold}
          </p>
          <p className="text-nd-text-secondary text-sm italic">“{carcaraQuoteFor(rankUp.score)}”</p>
        </div>
      )}
    </Modal>
  );
}

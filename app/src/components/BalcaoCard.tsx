import { useStreetCredStore } from "@/stores/street-cred";

/**
 * Carcará quotes, keyed by ladder score — the line the bartender gives a
 * corredor at that standing. Falls back to the entry line (score 10) for
 * scores below the first quote tier.
 */
const CARCARA_QUOTES: Record<number, string> = {
  100: "Lenda bebe de graça. O drink é seu — o nome fica no menu pra sempre.",
  90: "Cê quer ser rico. Rico some. Cê quer ser lembrado. Lembrado vira lenda.",
  50: "Esse trampo? Cê não volta. Se voltar, a cerveja é por minha conta. Se não voltar... foi um prazer.",
  25: "Sentou no balcão pedindo conselho, agora vai pro campo ganhar o seu. Bem-vindo ao jogo de verdade, moleque.",
  10: "Me lembra do que eu fiz pra chegar aqui. Já foi o que você quer ser — e pagou o preço.",
};

/** Quote for the highest ladder tier at or below `score` (floor: entry line). */
export function carcaraQuoteFor(score: number): string {
  const tiers = Object.keys(CARCARA_QUOTES)
    .map(Number)
    .sort((a, b) => b - a);
  for (const tier of tiers) {
    if (score >= tier) return CARCARA_QUOTES[tier];
  }
  return CARCARA_QUOTES[10];
}

/**
 * The bar's keep — Carcará's diegetic card between the bar header and the
 * tabs. Pure flavor: the quote shifts with the player's live Moral; the rule
 * is static. No portrait — the text carries the presence.
 */
export default function BalcaoCard() {
  const score = useStreetCredStore((s) => s.info?.score ?? null);

  return (
    <div className="card border-nd-gold/40 shadow-neon-gold p-4 sm:p-5">
      <p className="font-data text-nd-micro text-nd-gold uppercase tracking-widest mb-2">
        CARCARÁ // A LENDA
      </p>
      <p className="text-nd-text text-sm italic border-l-2 border-nd-gold/40 pl-3">
        “{carcaraQuoteFor(score ?? 0)}”
      </p>
      <p className="font-data text-nd-micro text-nd-text-secondary uppercase tracking-widest mt-4 mb-1">
        A Regra
      </p>
      <p className="text-nd-text-secondary text-xs">
        Dentro da Saideira não se saca arma, não se ativa cromo ofensivo, não se levanta a voz acima
        de 80 decibéis.
      </p>
    </div>
  );
}

/**
 * Diegetic district banner for Babilônia — "tudo tem preço. Inclusive você"
 * (docs/definicoes-de-produto/02-mundo-e-universo.md). Static band with a
 * minimalist feira-stall glyph (the pastel is real; the cana is vat 65). No
 * imagery — glyph + terminal type only.
 */
export default function DistrictBanner() {
  return (
    <div className="flex items-center gap-3 border-y border-nd-gold/20 bg-gradient-to-r from-nd-bg via-nd-surface to-nd-bg px-4 py-3">
      <svg
        viewBox="0 0 32 32"
        width="26"
        height="26"
        aria-hidden="true"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="shrink-0 text-nd-gold/60"
      >
        {/* Feira stall: scalloped awning, counter, two pasteis. */}
        <path d="M4 9 H28" />
        <path d="M4 9 Q7 14 10 9 Q13 14 16 9 Q19 14 22 9 Q25 14 28 9" />
        <path d="M8 14 V25 M24 14 V25" />
        <path d="M6 25 H26" />
        <circle cx="12" cy="20" r="2" />
        <circle cx="20" cy="20" r="2" />
      </svg>
      <p className="font-heading text-xs sm:text-sm tracking-widest text-nd-gold">
        BABILÔNIA <span className="text-nd-text-secondary">// MERCADO DO SUBMUNDO</span>
      </p>
    </div>
  );
}

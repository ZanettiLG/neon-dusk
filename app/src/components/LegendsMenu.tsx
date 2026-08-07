import { useEffect } from "react";
import { useSaideiraStore } from "@/stores/saideira";

/** Extract the year from an ISO timestamp (e.g. "2085-03-15T..." → 2085). */
function yearOf(iso: string): string {
  return new Date(iso).getUTCFullYear().toString();
}

/**
 * Saideira Legends menu — permanent hall of fame drink cards. Fetches on
 * mount; empty state per contract ("Nenhuma lenda ainda.").
 */
export default function LegendsMenu() {
  const legends = useSaideiraStore((s) => s.legends);
  const loading = useSaideiraStore((s) => s.legendsLoading);
  const error = useSaideiraStore((s) => s.legendsError);
  const fetchLegends = useSaideiraStore((s) => s.fetchLegends);

  useEffect(() => {
    void fetchLegends();
  }, [fetchLegends]);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-heading text-nd-gold text-lg tracking-widest">MENU DE LENDAS</h3>
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-gold border border-nd-gold/40 rounded-terminal px-2 py-0.5">
          ⭐ PERMANENTE
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-nd-magenta text-sm font-data">{error}</p>
          <button className="btn-neon text-xs px-3 py-1" onClick={() => void fetchLegends()}>
            Tentar de novo
          </button>
        </div>
      ) : loading && !legends ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse bg-nd-bg/60 border border-nd-gold/10 rounded-terminal"
            />
          ))}
        </div>
      ) : !legends || legends.legends.length === 0 ? (
        <p className="text-nd-text-secondary text-sm font-data">
          Nenhuma lenda ainda. O primeiro nome gravado no balcão pode ser o seu.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {legends.legends.map((entry) => (
            <div
              key={entry.id}
              className="border border-nd-gold/40 bg-nd-surface rounded-terminal p-4 flex flex-col"
            >
              <p className="font-heading text-nd-gold text-base tracking-widest">
                {entry.characterName}
              </p>
              <div className="h-px bg-nd-gold/30 my-2" aria-hidden="true" />
              <p className="font-heading text-sm text-nd-text">{entry.drinkName}</p>
              <div className="mt-auto pt-3 flex items-center justify-between">
                <span className="font-data text-xs text-nd-text-secondary">
                  Desde {yearOf(entry.achievedAt)}
                </span>
                <span className="font-data text-[10px] uppercase tracking-wider text-nd-text-secondary border border-nd-text-secondary/30 rounded-terminal px-1.5 py-0.5">
                  {entry.crewName ?? "Sem crew"}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

import { useEffect } from "react";
import { useSaideiraStore } from "@/stores/saideira";

/**
 * TOP 5 CREWS — placeholder until ND-016 (crews) ships. The API contract
 * (GET /api/saideira/leaderboard/crews) is already stable and returns an
 * empty list; this section renders the "Em breve" state and will swap to a
 * real table (similar to Leaderboard.tsx) when crews land.
 */
export default function CrewLeaderboard() {
  const crews = useSaideiraStore((s) => s.crewLeaderboard);
  const loading = useSaideiraStore((s) => s.crewLoading);
  const error = useSaideiraStore((s) => s.crewError);
  const fetchCrewLeaderboard = useSaideiraStore((s) => s.fetchCrewLeaderboard);

  useEffect(() => {
    void fetchCrewLeaderboard();
  }, [fetchCrewLeaderboard]);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-heading text-nd-cyan text-lg tracking-widest">TOP 5 BONDES</h3>
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary border border-nd-cyan/20 rounded-terminal px-2 py-0.5">
          EM BREVE
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-nd-magenta text-sm font-data">{error}</p>
          <button className="btn-neon text-xs px-3 py-1" onClick={() => void fetchCrewLeaderboard()}>
            Tentar de novo
          </button>
        </div>
      ) : loading && !crews ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse bg-nd-bg/60 border border-nd-cyan/10 rounded-terminal" />
          ))}
        </div>
      ) : (
        <p className="text-nd-text-secondary text-sm font-data">
          Em breve — os bondes chegam na Fase 2. Enquanto isso, os rumores correm no balcão.
        </p>
      )}
    </section>
  );
}

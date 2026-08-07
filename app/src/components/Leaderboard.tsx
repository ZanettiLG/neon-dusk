import { useEffect } from "react";
import { useStreetCredStore } from "@/stores/street-cred";
import { useAuthStore } from "@/stores/auth";

/** Title badge color per rank — gold for Legend, cyan for Elite+, default text. */
function titleBadgeClass(title: string): string {
  if (title === "Legend") return "border-nd-gold/60 text-nd-gold";
  if (title === "Elite") return "border-nd-cyan/50 text-nd-cyan";
  return "border-nd-text-secondary/30 text-nd-text-secondary";
}

/**
 * Public top-50 street-cred leaderboard (Dashboard section). Fetches on mount,
 * highlights the current runner's row with a cyan edge, skeleton rows while
 * loading and a retry button on failure.
 */
export default function Leaderboard() {
  const leaderboard = useStreetCredStore((s) => s.leaderboard);
  const loading = useStreetCredStore((s) => s.leaderboardLoading);
  const error = useStreetCredStore((s) => s.leaderboardError);
  const fetchLeaderboard = useStreetCredStore((s) => s.fetchLeaderboard);
  const myName = useAuthStore((s) => s.character?.name ?? null);

  useEffect(() => {
    void fetchLeaderboard(20);
  }, [fetchLeaderboard]);

  return (
    <section className="card">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="font-heading text-nd-cyan text-lg tracking-widest">RANKING // STREET CRED</h3>
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary border border-nd-cyan/20 rounded-terminal px-2 py-0.5">
          TOP 20
        </span>
      </div>

      {error ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-nd-magenta text-sm font-data">{error}</p>
          <button className="btn-neon text-xs px-3 py-1" onClick={() => void fetchLeaderboard(20)}>
            Tentar de novo
          </button>
        </div>
      ) : loading && !leaderboard ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse bg-nd-bg/60 border border-nd-cyan/10 rounded-terminal" />
          ))}
        </div>
      ) : !leaderboard || leaderboard.length === 0 ? (
        <p className="text-nd-text-secondary text-sm font-data">Nenhum runner ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-data">
            <thead>
              <tr className="text-left text-nd-text-secondary text-[10px] uppercase tracking-widest">
                <th className="py-1 pr-2 font-normal">#</th>
                <th className="py-1 pr-2 font-normal">Runner</th>
                <th className="py-1 pr-2 font-normal">Título</th>
                <th className="py-1 font-normal text-right">SC</th>
              </tr>
            </thead>
            <tbody>
              {leaderboard.map((entry) => {
                const isMe = entry.characterName === myName;
                return (
                  <tr
                    key={`${entry.position}-${entry.characterName}`}
                    className={`border-t border-nd-cyan/10 ${
                      isMe ? "border-l-2 border-l-nd-cyan bg-nd-cyan/5" : ""
                    }`}
                  >
                    <td className="py-2 pr-2 text-nd-text-secondary">{entry.position}</td>
                    <td className={`py-2 pr-2 ${isMe ? "text-nd-cyan" : "text-nd-text"}`}>
                      {entry.characterName}
                      {isMe && <span className="ml-2 text-[10px] text-nd-cyan/70">← você</span>}
                    </td>
                    <td className="py-2 pr-2">
                      <span
                        className={`border rounded-terminal px-1.5 py-0.5 text-[10px] uppercase tracking-wider ${titleBadgeClass(entry.title)}`}
                      >
                        {entry.title}
                      </span>
                    </td>
                    <td className="py-2 text-right text-nd-gold">{entry.score}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

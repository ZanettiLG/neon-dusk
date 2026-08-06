import { useState } from "react";
import { api, ApiError } from "@/api/client";
import type { LuckyChipResponse } from "@neon-dusk/shared";

/**
 * Lucky Chip (ND-008) — disposable test minigame widget.
 * Bet eddies, roll 1d20 (>=11 wins 2x), see the balance update live.
 */
export default function LuckyChipWidget() {
  const [bet, setBet] = useState("10");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<LuckyChipResponse | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);

  async function handleRoll() {
    const betNum = parseInt(bet, 10);
    if (!betNum || betNum < 1) return;

    setLoading(true);
    setError(null);
    setAnimating(true);
    setResult(null);

    try {
      const res = await api.post<LuckyChipResponse>("/api/game/lucky-chip", { bet: betNum });
      await new Promise((r) => setTimeout(r, 600));
      setResult(res);
      setBalance(res.balance);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha na conexão");
    } finally {
      setLoading(false);
      setAnimating(false);
    }
  }

  return (
    <div className="card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-lg text-nd-gold tracking-widest">
          CASSINO // LUCKY CHIP
        </h3>
        <span className="font-data text-sm text-nd-text-secondary">
          Saldo: {balance !== null ? `${balance} €$` : "—"}
        </span>
      </div>

      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <label className="block text-xs font-data text-nd-text-secondary mb-1">
            APOSTA (€$)
          </label>
          <input
            type="number"
            min={1}
            value={bet}
            onChange={(e) => setBet(e.target.value)}
            disabled={loading}
            className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2
                       font-data text-nd-text focus:border-nd-cyan focus:outline-none
                       disabled:opacity-50"
          />
        </div>
        <button
          className="btn-neon px-6 py-2 disabled:opacity-50"
          disabled={loading || !bet || parseInt(bet, 10) < 1}
          onClick={() => void handleRoll()}
        >
          {loading ? "ROLANDO..." : "ROLL D20"}
        </button>
      </div>

      {animating && (
        <div className="text-center py-3">
          <span className="font-data text-4xl text-nd-cyan animate-pulse">
            {Math.floor(Math.random() * 20) + 1}
          </span>
        </div>
      )}

      {result && !animating && (
        <div
          className={`text-center py-3 border rounded-terminal ${
            result.won ? "border-nd-cyan/40 bg-nd-cyan/5" : "border-nd-magenta/40 bg-nd-magenta/5"
          }`}
        >
          <div className={`font-data text-4xl ${result.won ? "text-nd-cyan" : "text-nd-magenta"}`}>
            {result.roll}
          </div>
          <p
            className={`font-heading text-sm mt-1 tracking-widest ${
              result.won ? "text-nd-cyan" : "text-nd-magenta"
            }`}
          >
            {result.won ? `GANHOU +${result.payout} €$` : "PERDEU"}
          </p>
        </div>
      )}

      {error && <p className="text-nd-magenta text-xs font-data">{error}</p>}

      <p className="text-nd-text-secondary text-xs font-data">
        // Role 1d20. 11+ dobra a aposta. Casa sem borda — é só um teste.
      </p>
    </div>
  );
}

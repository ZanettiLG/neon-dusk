import { useEffect } from "react";
import { useAdminStore } from "@/stores/admin";

/**
 * Economy dashboard tab (ND-052). Big-number cards, hourly bar chart,
 * top faucets and sinks side by side.
 */
export default function EconomyTab() {
  const { economy, economyLoading, economyError, fetchEconomy } = useAdminStore();

  useEffect(() => {
    fetchEconomy();
  }, [fetchEconomy]);

  if (economyLoading && !economy) {
    return <div className="text-nd-text-secondary text-sm">Carregando...</div>;
  }

  if (economyError) {
    return <div className="text-nd-magenta text-sm">{economyError}</div>;
  }

  if (!economy) return null;

  const maxHourly = Math.max(1, ...economy.hourlyBreakdown24h.map((h) => h.count));

  return (
    <div>
      {/* Big-number cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card
          label="Eddies em Circulação"
          value={economy.eddiesInCirculation.toLocaleString()}
          unit="€$"
        />
        <Card label="Ativos (24h)" value={String(economy.dailyActiveCharacters)} />
        <Card label="Transações (24h)" value={String(economy.transactions24h)} />
        <Card
          label="Top Faucet"
          value={
            economy.topFaucets24h.length > 0
              ? `${economy.topFaucets24h[0].amount.toLocaleString()} €$`
              : "—"
          }
          sub={economy.topFaucets24h[0]?.source}
        />
      </div>

      {/* Hourly breakdown bar chart */}
      <div className="mb-8">
        <h3 className="font-mono text-nd-cyan text-sm mb-3">
          Atividade por Hora (24h)
        </h3>
        <div className="flex items-end gap-1 h-32">
          {economy.hourlyBreakdown24h.map((h) => (
            <div
              key={h.hour}
              className="flex-1 bg-nd-cyan/60 hover:bg-nd-cyan transition-colors rounded-t-sm"
              style={{ height: `${Math.max(2, (h.count / maxHourly) * 100)}%` }}
              title={`${new Date(h.hour).toLocaleTimeString("pt-BR", {
                hour: "2-digit",
              })}: ${h.count}`}
            />
          ))}
          {economy.hourlyBreakdown24h.length === 0 && (
            <div className="text-nd-text-secondary text-xs w-full text-center self-center">
              Nenhum evento nas últimas 24h
            </div>
          )}
        </div>
        <div className="flex justify-between mt-1 text-nd-text-secondary text-[10px] font-mono">
          <span>24h atrás</span>
          <span>agora</span>
        </div>
      </div>

      {/* Top faucets + sinks side by side */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        <div>
          <h3 className="font-mono text-nd-cyan text-sm mb-3">Top Faucets (24h)</h3>
          {economy.topFaucets24h.length === 0 && (
            <span className="text-nd-text-secondary text-xs">Nenhum</span>
          )}
          {economy.topFaucets24h.map((f) => (
            <div
              key={f.source}
              className="flex justify-between py-1 border-b border-nd-cyan/5 text-sm"
            >
              <span className="text-nd-text font-mono">{f.source}</span>
              <span className="text-nd-green font-mono">+{f.amount.toLocaleString()} €$</span>
            </div>
          ))}
        </div>
        <div>
          <h3 className="font-mono text-nd-cyan text-sm mb-3">Top Sinks (24h)</h3>
          {economy.topSinks24h.length === 0 && (
            <span className="text-nd-text-secondary text-xs">Nenhum</span>
          )}
          {economy.topSinks24h.map((s) => (
            <div
              key={s.source}
              className="flex justify-between py-1 border-b border-nd-cyan/5 text-sm"
            >
              <span className="text-nd-text font-mono">{s.source}</span>
              <span className="text-nd-magenta font-mono">-{s.amount.toLocaleString()} €$</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Card({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
}) {
  return (
    <div className="bg-nd-surface border border-nd-cyan/10 rounded-lg p-4">
      <div className="text-nd-text-secondary text-xs font-mono uppercase mb-2">{label}</div>
      <div className="text-2xl font-mono text-nd-text">
        {value}
        {unit && <span className="text-nd-text-secondary text-sm ml-1">{unit}</span>}
      </div>
      {sub && <div className="text-nd-text-secondary text-xs font-mono mt-1">{sub}</div>}
    </div>
  );
}

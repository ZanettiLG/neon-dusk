import { useState } from "react";
import PlayersTab from "./PlayersTab";
import EconomyTab from "./EconomyTab";
import ParamsTab from "./ParamsTab";
import AuditTab from "./AuditTab";

const TABS = [
  { key: "players", label: "Jogadores" },
  { key: "economy", label: "Economia" },
  { key: "params", label: "Params" },
  { key: "audit", label: "Auditoria" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/**
 * Admin panel shell (ND-052). Tab-based navigation for player management,
 * economy overview, game parameters, and audit log.
 */
export default function AdminPanel() {
  const [active, setActive] = useState<TabKey>("players");

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <h2 className="font-heading text-2xl text-nd-cyan tracking-wider mb-6">
        ADMIN<span className="text-nd-gold">//</span>PAINEL
      </h2>

      {/* Tabs */}
      <nav className="flex gap-0 mb-6 border-b border-nd-cyan/20">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActive(tab.key)}
            className={`px-5 py-2 font-mono text-sm transition-colors ${
              active === tab.key
                ? "text-nd-gold border-b-2 border-nd-gold"
                : "text-nd-text-secondary hover:text-nd-text"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {/* Active Tab */}
      <div>
        {active === "players" && <PlayersTab />}
        {active === "economy" && <EconomyTab />}
        {active === "params" && <ParamsTab />}
        {active === "audit" && <AuditTab />}
      </div>
    </div>
  );
}

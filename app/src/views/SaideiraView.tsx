import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { useSaideiraStore } from "@/stores/saideira";
import ChatBox from "@/components/ChatBox";
import BalcaoCard from "@/components/BalcaoCard";
import LegendsMenu from "@/components/LegendsMenu";
import CrewLeaderboard from "@/components/CrewLeaderboard";
import Leaderboard from "@/components/Leaderboard";
import { Tab } from "@/components/ui";

type TabKey = "chat" | "ranking" | "legends";

/** SC < 10 gate — you're not known enough to sit at the bar yet. */
function SaideiraGate() {
  return (
    <div className="py-12 max-w-md mx-auto">
      <div className="card border-nd-magenta/40 shadow-neon-magenta text-center py-10 px-6 space-y-4">
        <p className="font-heading text-2xl text-nd-magenta tracking-widest">⚡ ACESSO RESTRITO</p>
        <p className="text-nd-text text-sm">
          Você ainda não é conhecido o suficiente para entrar na Saideira. Volte quando tiver Moral
          10.
        </p>
        <Link to="/dashboard" className="btn-neon inline-block font-data text-xs">
          VER MINHA MORAL →
        </Link>
      </div>
    </div>
  );
}

/**
 * Saideira Hub (Babilônia) — the bar that never closes. Gate: SC >= 10.
 * Three tabs: real-time chat (SSE), street-cred + crew rankings, and the
 * permanent Legends drink menu. All data loads on mount (design §8.3).
 */
export default function SaideiraView() {
  const character = useAuthStore((s) => s.character);
  const hub = useSaideiraStore((s) => s.hub);
  const fetchHub = useSaideiraStore((s) => s.fetchHub);
  const fetchHistory = useSaideiraStore((s) => s.fetchHistory);
  const connectChat = useSaideiraStore((s) => s.connectChat);
  const disconnectChat = useSaideiraStore((s) => s.disconnectChat);
  const fetchLegends = useSaideiraStore((s) => s.fetchLegends);
  const fetchCrewLeaderboard = useSaideiraStore((s) => s.fetchCrewLeaderboard);

  const [tab, setTab] = useState<TabKey>("chat");

  useEffect(() => {
    void fetchHub();
    void fetchHistory();
    void fetchLegends();
    void fetchCrewLeaderboard();
    connectChat();
    return () => disconnectChat();
  }, [fetchHub, fetchHistory, fetchLegends, fetchCrewLeaderboard, connectChat, disconnectChat]);

  if (!character) return null; // RequireCharacter guards this route
  if (character.streetCred < 10) return <SaideiraGate />;

  return (
    <div className="py-8 space-y-6">
      {/* Bar header */}
      <div className="card border-nd-cyan/30 shadow-neon-cyan">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">
              SAIDEIRA <span className="text-nd-text-secondary">//</span> O BAR QUE NUNCA FECHA
            </h2>
            <p className="text-nd-text-secondary text-sm mt-1">
              Babilônia — o neon pisca, o uísque é sintético e as lendas nunca saem do menu.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-data text-xs text-nd-text-secondary">
              🟢 <span className="text-nd-green">{hub?.onlineCount ?? 0} online</span>
              {" · "}Round <span className="text-nd-cyan">{hub?.currentRound ?? 1}</span>
            </p>
            <p className="font-data text-[10px] text-nd-text-secondary mt-1">
              último reset: {hub?.lastReset ? hub.lastReset.slice(0, 10) : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Carcará's keep — diegetic flavor card (SC >= 10 gate already passed). */}
      <BalcaoCard />

      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <Tab state={tab === "chat" ? "active" : "inactive"} onClick={() => setTab("chat")}>
          Chat
        </Tab>
        <Tab state={tab === "ranking" ? "active" : "inactive"} onClick={() => setTab("ranking")}>
          Ranking
        </Tab>
        <Tab state={tab === "legends" ? "active" : "inactive"} onClick={() => setTab("legends")}>
          Lendas
        </Tab>
      </div>

      {/* Tab content */}
      {tab === "chat" && <ChatBox />}

      {tab === "ranking" && (
        <div className="space-y-6">
          <Leaderboard />
          <CrewLeaderboard />
        </div>
      )}

      {tab === "legends" && <LegendsMenu />}
    </div>
  );
}

import { useEffect, useMemo, useState, type ReactNode } from "react";
import type { GigTier, GigType } from "@neon-dusk/shared";
import { GIG_TIERS, GIG_TYPES } from "@neon-dusk/shared";
import { useGigStore } from "@/stores/gig";
import GigCard from "@/components/GigCard";
import ActiveGigPanel from "@/components/ActiveGigPanel";
import { GIG_TYPE_LABELS } from "@/lib/labels";

type TierFilter = "all" | GigTier;
type TypeFilter = "all" | GigType;

/** Reusable filter tab. */
function Tab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      className={`font-data text-[11px] uppercase tracking-widest border rounded-terminal px-3 py-1 transition-colors ${
        active
          ? "border-nd-cyan text-nd-cyan bg-nd-cyan/10"
          : "border-nd-cyan/20 text-nd-text-secondary hover:border-nd-cyan/50"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

/**
 * Despachante Cupim's gig board — the first contact with the underworld. Lists the
 * T1-T2 catalog filtered by tier/type and hosts the active-gig panel.
 */
export default function GigBoardView() {
  const board = useGigStore((s) => s.board);
  const boardLoading = useGigStore((s) => s.boardLoading);
  const boardError = useGigStore((s) => s.boardError);
  const actionLoading = useGigStore((s) => s.actionLoading);
  const actionError = useGigStore((s) => s.actionError);
  const lastWrapup = useGigStore((s) => s.lastWrapup);
  const fetchBoard = useGigStore((s) => s.fetchBoard);
  const acceptGig = useGigStore((s) => s.acceptGig);

  const [tier, setTier] = useState<TierFilter>("all");
  const [type, setType] = useState<TypeFilter>("all");

  useEffect(() => {
    void fetchBoard();
  }, [fetchBoard]);

  const filtered = useMemo(() => {
    const gigs = board?.gigs ?? [];
    return gigs.filter(
      (g) => (tier === "all" || g.tier === tier) && (type === "all" || g.type === type),
    );
  }, [board, tier, type]);

  const hasActiveGig = Boolean(board?.activeGig) || Boolean(lastWrapup);

  async function onAccept(id: string): Promise<void> {
    try {
      await acceptGig(id);
    } catch {
      // error already surfaced through actionError
    }
  }

  return (
    <div className="py-8 space-y-6">
      {/* Despachante header */}
      <div className="card border-nd-purple/40 shadow-neon-purple">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-heading text-2xl text-nd-purple tracking-widest">
              CUPIM <span className="text-nd-text-secondary">//</span> O PORTEIRO
            </h2>
            <p className="text-nd-text-secondary text-sm mt-1">
              Babilônia — tudo tem preço. Inclusive você. Primeiro despachante do corre, gig de rua,
              entrega quente e dinheiro na mão.
            </p>
          </div>
          <div className="text-right shrink-0">
            <p className="font-data text-[10px] text-nd-text-secondary">
              "{"Mano, preciso que você entregue esse pacote antes que o dono perceba que sumiu. Corre!"}"
            </p>
          </div>
        </div>
      </div>

      {/* Active gig */}
      {hasActiveGig && <ActiveGigPanel />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary mr-1">
          Filtro
        </span>
        <Tab active={tier === "all"} onClick={() => setTier("all")}>
          Todos
        </Tab>
        {GIG_TIERS.map((t) => (
          <Tab key={t} active={tier === t} onClick={() => setTier(t)}>
            {t.toUpperCase()}
          </Tab>
        ))}
        <span className="w-px h-4 bg-nd-cyan/20 mx-1" aria-hidden="true"></span>
        <Tab active={type === "all"} onClick={() => setType("all")}>
          Todos tipos
        </Tab>
        {GIG_TYPES.map((t) => (
          <Tab key={t} active={type === t} onClick={() => setType(t)}>
            {GIG_TYPE_LABELS[t]}
          </Tab>
        ))}
      </div>

      {/* Board states */}
      {boardLoading && !board ? (
        <div className="card text-center py-10">
          <span className="text-nd-text-secondary animate-pulse-neon font-data">
            ▌ acessando o quadro do Cupim...
          </span>
        </div>
      ) : boardError && !board ? (
        <div className="card text-center py-10 space-y-3">
          <p className="font-data text-nd-magenta">✗ {boardError}</p>
          <button className="btn-neon text-xs" onClick={() => void fetchBoard()}>
            Tentar de novo
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-nd-text-secondary font-data text-sm">
            Nenhum gig com esse filtro. O Cupim coça a cabeça: "{"Cê quer o quê, exatamente?"}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((gig) => (
            <GigCard
              key={gig.id}
              gig={gig}
              disabled={Boolean(board?.activeGig) || actionLoading}
              onAccept={(id) => void onAccept(id)}
            />
          ))}
        </div>
      )}

      {actionError && <p className="font-data text-xs text-nd-magenta">✗ {actionError}</p>}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import type { GigTier, GigType } from "@neon-dusk/shared";
import { GIG_TIERS, GIG_TYPES } from "@neon-dusk/shared";
import { useGigStore } from "@/stores/gig";
import GigCard from "@/components/GigCard";
import ActiveGigPanel from "@/components/ActiveGigPanel";
import FixerPortrait from "@/components/FixerPortrait";
import DistrictBanner from "@/components/DistrictBanner";
import { Tab } from "@/components/ui";
import { GIG_TYPE_LABELS } from "@/lib/labels";

type TierFilter = "all" | GigTier;
type TypeFilter = "all" | GigType;

/**
 * Despachante Cupim's trampo board — the first contact with the underworld. Lists the
 * T1-T2 catalog filtered by tier/type and hosts the active-trampo panel.
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
    const trampos = board?.gigs ?? [];
    return trampos.filter(
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
      <div className="card border-nd-purple/40 shadow-neon-purple space-y-3">
        <div className="flex items-start gap-4">
          <FixerPortrait size="lg" />
          <div className="min-w-0">
            <h2 className="font-heading text-2xl text-nd-purple tracking-widest">
              CUPIM <span className="text-nd-text-secondary">//</span> O PORTEIRO
            </h2>
            <p className="text-nd-text-secondary text-sm mt-1">
              Babilônia — tudo tem preço. Inclusive você. Primeiro despachante do corre, trampo de
              rua, entrega quente e dinheiro na mão.
            </p>
          </div>
        </div>

        <DistrictBanner />

        {/* Loop de rua do Cupim: vocativo → status → pacto. */}
        <div className="space-y-1 border-l-2 border-nd-purple/40 pl-3">
          <p className="font-data text-[11px] text-nd-text-secondary">
            "
            {
              "Salve, mano. Firmeza? Babilônia não perdoa quem vacila. Traz o resultado que a grana tá no jeito."
            }
            "
          </p>
          <p className="font-data text-[11px] text-nd-purple/70">
            "
            {
              "Mano, preciso que você entregue esse pacote antes que o dono perceba que sumiu. Corre!"
            }
            "
          </p>
        </div>
      </div>

      {/* Trampo ativo */}
      {hasActiveGig && <ActiveGigPanel />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2" role="tablist">
        <span className="font-data text-[10px] uppercase tracking-widest text-nd-text-secondary mr-1">
          Filtro
        </span>
        <Tab state={tier === "all" ? "active" : "inactive"} onClick={() => setTier("all")}>
          Todos
        </Tab>
        {GIG_TIERS.map((t) => (
          <Tab key={t} state={tier === t ? "active" : "inactive"} onClick={() => setTier(t)}>
            {t.toUpperCase()}
          </Tab>
        ))}
        <span className="w-px h-4 bg-nd-cyan/20 mx-1" aria-hidden="true"></span>
        <Tab state={type === "all" ? "active" : "inactive"} onClick={() => setType("all")}>
          Todos tipos
        </Tab>
        {GIG_TYPES.map((t) => (
          <Tab key={t} state={type === t ? "active" : "inactive"} onClick={() => setType(t)}>
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
            Nenhum trampo com esse filtro. O Cupim coça a cabeça: "{"Cê quer o quê, exatamente?"}"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((trampo) => (
            <GigCard
              key={trampo.id}
              trampo={trampo}
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

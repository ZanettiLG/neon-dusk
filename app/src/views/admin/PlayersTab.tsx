import { useEffect, useState, useCallback, useRef } from "react";
import { useAdminStore } from "@/stores/admin";
import type { AdminPlayer } from "@neon-dusk/shared";
import { formatRelativeTime } from "@/lib/format";

/** Status badge colors. */
const STATUS_COLORS: Record<AdminPlayer["status"], string> = {
  active: "text-nd-cyan border-nd-cyan/30",
  banned: "text-nd-magenta border-nd-magenta/30",
  circuit_broken: "text-nd-gold border-nd-gold/30",
};

const STATUS_LABELS: Record<AdminPlayer["status"], string> = {
  active: "ativo",
  banned: "banido",
  circuit_broken: "circuit break",
};

/**
 * Player management tab. Search, sort, paginated table with ban/unban actions.
 */
export default function PlayersTab() {
  const {
    players,
    playersTotal,
    playersPage,
    playersLoading,
    playersError,
    fetchPlayers,
    banPlayer,
    unbanPlayer,
  } = useAdminStore();

  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("sc");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Modal state.
  const [modalPlayer, setModalPlayer] = useState<AdminPlayer | null>(null);
  const [modalAction, setModalAction] = useState<"ban" | "unban" | null>(null);
  const [banReason, setBanReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // Debounced search.
  const handleSearch = useCallback(
    (value: string) => {
      setSearch(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        fetchPlayers({ search: value, sort, page: 1 });
      }, 500);
    },
    [fetchPlayers, sort],
  );

  // Initial load + sort changes.
  useEffect(() => {
    fetchPlayers({ sort, page: playersPage });
  }, [sort]);

  const handleSort = (newSort: string) => {
    setSort(newSort);
  };

  const handlePage = (dir: 1 | -1) => {
    const next = Math.max(1, playersPage + dir);
    fetchPlayers({ page: next, sort, search: search || undefined });
  };

  const handleBan = async () => {
    if (!modalPlayer || !banReason.trim()) return;
    setActionLoading(true);
    try {
      await banPlayer(modalPlayer.id, banReason.trim());
      setModalPlayer(null);
      setModalAction(null);
      setBanReason("");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    if (!modalPlayer) return;
    setActionLoading(true);
    try {
      await unbanPlayer(modalPlayer.id);
      setModalPlayer(null);
      setModalAction(null);
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (player: AdminPlayer, action: "ban" | "unban") => {
    setModalPlayer(player);
    setModalAction(action);
    setBanReason("");
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <input
          type="text"
          placeholder="Buscar jogador..."
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="bg-nd-surface border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm w-full sm:w-64 font-mono focus:border-nd-cyan outline-none"
        />
        <select
          value={sort}
          onChange={(e) => handleSort(e.target.value)}
          className="bg-nd-surface border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm font-mono focus:border-nd-cyan outline-none"
        >
          <option value="sc">Street Cred</option>
          <option value="name">Nome</option>
          <option value="level">Level</option>
          <option value="last_activity">Última atividade</option>
        </select>
      </div>

      {/* Error */}
      {playersError && (
        <div className="text-nd-magenta text-sm mb-4">{playersError}</div>
      )}

      {/* Loading */}
      {playersLoading && (
        <div className="text-nd-text-secondary text-sm mb-4">Carregando...</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-nd-cyan/20 text-nd-text-secondary font-mono text-xs uppercase">
              <th className="py-2 px-3">Nome</th>
              <th className="py-2 px-3">LV</th>
              <th className="py-2 px-3">SC</th>
              <th className="py-2 px-3">Eddies</th>
              <th className="py-2 px-3 hidden sm:table-cell">Crew</th>
              <th className="py-2 px-3 hidden sm:table-cell">Último login</th>
              <th className="py-2 px-3">Status</th>
              <th className="py-2 px-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="border-b border-nd-cyan/5 hover:bg-nd-surface/50 transition-colors"
              >
                <td className="py-2 px-3 text-nd-text font-mono">{p.name}</td>
                <td className="py-2 px-3 text-nd-text-secondary">{p.level}</td>
                <td className="py-2 px-3 text-nd-gold font-mono">{p.sc}</td>
                <td className="py-2 px-3 text-nd-text font-mono">
                  {p.eddies.toLocaleString()}
                </td>
                <td className="py-2 px-3 text-nd-text-secondary hidden sm:table-cell">
                  {p.crew ?? "—"}
                </td>
                <td className="py-2 px-3 text-nd-text-secondary text-xs hidden sm:table-cell">
                  {p.lastLogin ? formatRelativeTime(p.lastLogin) : "nunca"}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded border font-mono ${STATUS_COLORS[p.status]}`}
                  >
                    {STATUS_LABELS[p.status]}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {p.status === "banned" ? (
                    <button
                      onClick={() => openModal(p, "unban")}
                      className="text-xs text-nd-cyan hover:underline font-mono"
                    >
                      unban
                    </button>
                  ) : (
                    <button
                      onClick={() => openModal(p, "ban")}
                      className="text-xs text-nd-magenta hover:underline font-mono"
                    >
                      ban
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {players.length === 0 && !playersLoading && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-nd-text-secondary">
                  Nenhum jogador encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between mt-4">
        <span className="text-nd-text-secondary text-xs font-mono">
          {playersTotal} jogadores — página {playersPage} de{" "}
          {Math.max(1, Math.ceil(playersTotal / 20))}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => handlePage(-1)}
            disabled={playersPage <= 1}
            className="px-3 py-1 text-xs font-mono border border-nd-cyan/20 rounded text-nd-text-secondary disabled:opacity-30 hover:border-nd-cyan/50"
          >
            ← Anterior
          </button>
          <button
            onClick={() => handlePage(1)}
            disabled={playersPage >= Math.ceil(playersTotal / 20)}
            className="px-3 py-1 text-xs font-mono border border-nd-cyan/20 rounded text-nd-text-secondary disabled:opacity-30 hover:border-nd-cyan/50"
          >
            Próximo →
          </button>
        </div>
      </div>

      {/* Ban/Unban Modal */}
      {modalPlayer && modalAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-nd-surface border border-nd-cyan/20 rounded-lg p-6 w-full max-w-md">
            <h3 className="font-mono text-nd-cyan mb-2">
              {modalAction === "ban" ? "Banir jogador" : "Remover ban"}
            </h3>
            <p className="text-nd-text-secondary text-sm mb-4">
              {modalAction === "ban"
                ? `Tem certeza? O banimento pode ser revertido por administradores.`
                : `Remover o ban de ${modalPlayer.name}?`}
            </p>
            {modalAction === "ban" && (
              <textarea
                value={banReason}
                onChange={(e) => setBanReason(e.target.value)}
                placeholder="Motivo do ban..."
                rows={3}
                className="w-full bg-nd-bg border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm font-mono focus:border-nd-cyan outline-none mb-4 resize-none"
              />
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setModalPlayer(null);
                  setModalAction(null);
                }}
                className="px-4 py-2 text-sm font-mono text-nd-text-secondary hover:text-nd-text"
              >
                Cancelar
              </button>
              <button
                onClick={modalAction === "ban" ? handleBan : handleUnban}
                disabled={actionLoading || (modalAction === "ban" && !banReason.trim())}
                className={`px-4 py-2 text-sm font-mono rounded ${
                  modalAction === "ban"
                    ? "bg-nd-magenta/20 text-nd-magenta border border-nd-magenta/30"
                    : "bg-nd-cyan/20 text-nd-cyan border border-nd-cyan/30"
                } disabled:opacity-40`}
              >
                {actionLoading ? "..." : modalAction === "ban" ? "Banir" : "Confirmar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

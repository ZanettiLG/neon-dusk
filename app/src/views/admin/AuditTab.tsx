import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/admin";

/**
 * Audit log viewer (ND-052). Filterable, cursor-paginated table
 * with IP-masked entries.
 */
export default function AuditTab() {
  const {
    auditEntries,
    auditCursor,
    auditLoading,
    auditError,
    fetchAuditLog,
    loadMoreAudit,
  } = useAdminStore();

  const [actionFilter, setActionFilter] = useState("");
  const [resultFilter, setResultFilter] = useState("");

  useEffect(() => {
    fetchAuditLog({
      action: actionFilter || undefined,
      result: resultFilter || undefined,
    });
  }, [fetchAuditLog, actionFilter, resultFilter]);

  const handleFilter = () => {
    fetchAuditLog({
      action: actionFilter || undefined,
      result: resultFilter || undefined,
    });
  };

  return (
    <div>
      {/* Filter bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
          }}
          className="bg-nd-surface border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm font-mono focus:border-nd-cyan outline-none"
        >
          <option value="">Todas ações</option>
          <option value="admin.ban">admin.ban</option>
          <option value="admin.unban">admin.unban</option>
          <option value="admin.update_params">admin.update_params</option>
          <option value="gig_accept">gig_accept</option>
          <option value="pvp_attack">pvp_attack</option>
          <option value="saideira_chat">saideira_chat</option>
        </select>
        <select
          value={resultFilter}
          onChange={(e) => {
            setResultFilter(e.target.value);
          }}
          className="bg-nd-surface border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm font-mono focus:border-nd-cyan outline-none"
        >
          <option value="">Todos resultados</option>
          <option value="allowed">allowed</option>
          <option value="blocked">blocked</option>
          <option value="rate_limited">rate_limited</option>
          <option value="validation_error">validation_error</option>
          <option value="circuit_break">circuit_break</option>
          <option value="cooldown_active">cooldown_active</option>
          <option value="server_error">server_error</option>
        </select>
        <button
          onClick={handleFilter}
          className="px-4 py-2 text-sm font-mono border border-nd-cyan/20 rounded text-nd-cyan hover:border-nd-cyan/50"
        >
          Filtrar
        </button>
      </div>

      {/* Error */}
      {auditError && (
        <div className="text-nd-magenta text-sm mb-4">{auditError}</div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left border-collapse">
          <thead>
            <tr className="border-b border-nd-cyan/20 text-nd-text-secondary font-mono text-xs uppercase">
              <th className="py-2 px-3">Timestamp</th>
              <th className="py-2 px-3">Personagem</th>
              <th className="py-2 px-3">Ação</th>
              <th className="py-2 px-3">Resultado</th>
              <th className="py-2 px-3 hidden md:table-cell">IP</th>
            </tr>
          </thead>
          <tbody>
            {auditEntries.map((entry) => (
              <tr
                key={entry.id}
                className="border-b border-nd-cyan/5 hover:bg-nd-surface/50 transition-colors"
              >
                <td className="py-2 px-3 text-nd-text-secondary text-xs font-mono">
                  {new Date(entry.timestamp).toLocaleString("pt-BR")}
                </td>
                <td className="py-2 px-3 text-nd-text font-mono text-xs">
                  {entry.characterName ?? "—"}
                </td>
                <td className="py-2 px-3 text-nd-text font-mono text-xs">
                  {entry.action}
                </td>
                <td className="py-2 px-3">
                  <span
                    className={`text-xs px-2 py-0.5 rounded font-mono ${
                      entry.result === "allowed"
                        ? "text-nd-green border border-nd-green/30"
                        : entry.result === "blocked" || entry.result === "rate_limited"
                          ? "text-nd-magenta border border-nd-magenta/30"
                          : "text-nd-gold border border-nd-gold/30"
                    }`}
                  >
                    {entry.result}
                  </span>
                </td>
                <td className="py-2 px-3 text-nd-text-secondary text-xs font-mono hidden md:table-cell">
                  {entry.ip}
                </td>
              </tr>
            ))}
            {auditEntries.length === 0 && !auditLoading && (
              <tr>
                <td colSpan={5} className="py-6 text-center text-nd-text-secondary">
                  Nenhum registro encontrado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Load More */}
      {auditCursor && (
        <div className="mt-4 text-center">
          <button
            onClick={loadMoreAudit}
            disabled={auditLoading}
            className="px-4 py-2 text-sm font-mono border border-nd-cyan/20 rounded text-nd-cyan hover:border-nd-cyan/50 disabled:opacity-30"
          >
            {auditLoading ? "Carregando..." : "Carregar mais"}
          </button>
        </div>
      )}
    </div>
  );
}

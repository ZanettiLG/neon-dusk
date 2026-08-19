import { useEffect, useState } from "react";
import { useAdminStore } from "@/stores/admin";

const PARAM_LABELS: Record<string, string> = {
  ROUND_DURATION_DAYS: "Duração da Rodada (dias)",
  NIL_REGEN_MINUTES: "Regen de NIL (minutos)",
  GIG_COOLDOWN_MINUTES: "Cooldown de trampos (minutos)",
  PVP_NIL_COST: "Custo de NIL no PvP",
  INITIAL_BALANCE: "Saldo Inicial (Grana)",
  MAX_CREW_SIZE: "Tamanho Máx. do Bonde",
};

/**
 * Game parameters form (ND-052). Displays current values, allows editing, and
 * provides a manual round-reset section (ND-018 — server-side x-api-key).
 */
export default function ParamsTab() {
  const { params, paramsLoading, paramsError, paramsSaving, fetchParams, updateParams } =
    useAdminStore();

  const [values, setValues] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchParams();
  }, [fetchParams]);

  useEffect(() => {
    setValues({ ...params });
  }, [params]);

  const handleChange = (key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await updateParams(values);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      // error is set in the store
    }
  };

  const hasChanges =
    JSON.stringify(values) !== JSON.stringify(params);

  if (paramsLoading && Object.keys(params).length === 0) {
    return <div className="text-nd-text-secondary text-sm">Carregando...</div>;
  }

  return (
    <div className="max-w-lg">
      {paramsError && (
        <div className="text-nd-magenta text-sm mb-4">{paramsError}</div>
      )}

      <div className="space-y-4">
        {Object.keys(PARAM_LABELS).map((key) => (
          <div key={key}>
            <label className="block text-nd-text-secondary text-xs font-mono mb-1">
              {PARAM_LABELS[key]}
            </label>
            <input
              type="number"
              value={values[key] ?? ""}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={params[key]}
              className="w-full bg-nd-surface border border-nd-cyan/20 rounded px-3 py-2 text-nd-text text-sm font-mono focus:border-nd-cyan outline-none"
            />
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-6">
        <button
          onClick={handleSave}
          disabled={!hasChanges || paramsSaving}
          className="px-5 py-2 bg-nd-gold/20 text-nd-gold border border-nd-gold/30 rounded font-mono text-sm disabled:opacity-30 hover:bg-nd-gold/30 transition-colors"
        >
          {paramsSaving ? "Salvando..." : "Salvar"}
        </button>
        {saved && (
          <span className="text-nd-green text-sm font-mono">
            ✓ Parâmetros salvos
          </span>
        )}
      </div>

      {/* Round Reset (ND-018) — server-side trigger via x-api-key */}
      <hr className="border-nd-cyan/10 my-6" />
      <div className="space-y-3">
        <h4 className="font-mono text-sm text-nd-magenta uppercase tracking-wider">
          ⚠ Zona de Perigo
        </h4>
        <p className="text-nd-text-secondary text-xs">
          Resetar a rodada zera Grana, Moral e progresso de todos os jogadores.
          Legends são preservadas. Execute via API com x-api-key:
        </p>
        <code className="block bg-nd-bg border border-nd-cyan/10 rounded px-3 py-2 text-xs font-mono text-nd-text-secondary break-all">
          curl -X POST http://localhost:3000/api/round/trigger-reset \
          -H "x-api-key: $ADMIN_API_KEY"
        </code>
      </div>
    </div>
  );
}

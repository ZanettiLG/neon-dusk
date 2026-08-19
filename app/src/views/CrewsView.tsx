import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { Crew } from "@neon-dusk/shared";
import { CREW_CREATE_SC } from "@neon-dusk/shared";
import { useAuthStore } from "@/stores/auth";
import { useCrewStore } from "@/stores/crew";

/**
 * Crew directory — browse gangs, found your own (SC >= 25).
 */
export default function CrewsView() {
  const navigate = useNavigate();
  const character = useAuthStore((s) => s.character);
  const { crews, crewsLoading, crewsError, fetchCrews, createCrew } = useCrewStore();

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createLoading, setCreateLoading] = useState(false);

  useEffect(() => {
    void fetchCrews();
  }, [fetchCrews]);

  async function onSubmitCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateLoading(true);
    setCreateError(null);
    try {
      const crew = await createCrew(name.trim(), tag.trim());
      setShowCreate(false);
      setName("");
      setTag("");
      navigate(`/crews/${crew.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Falha ao criar crew");
    } finally {
      setCreateLoading(false);
    }
  }

  const canCreate = (character?.streetCred ?? 0) >= CREW_CREATE_SC;

  return (
    <div className="py-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">CREWS</h2>
        {canCreate ? (
          <button className="btn-neon text-xs" onClick={() => setShowCreate(true)}>
            Fundar Crew
          </button>
        ) : (
          <span className="text-nd-text-secondary font-data text-xs">
            M {CREW_CREATE_SC} necessária para fundar
          </span>
        )}
      </div>

      {showCreate && (
        <div className="card border-nd-cyan/30">
          <form onSubmit={(e) => void onSubmitCreate(e)} className="space-y-3">
            <div>
              <label className="block text-xs font-data text-nd-text-secondary mb-1">Nome da Crew</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text font-data text-sm"
                maxLength={32}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-data text-nd-text-secondary mb-1">Tag (3-6 chars)</label>
              <input
                value={tag}
                onChange={(e) => setTag(e.target.value.toUpperCase())}
                className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-cyan font-data text-sm"
                maxLength={6}
                minLength={3}
                required
              />
            </div>
            {createError && <p className="text-nd-magenta text-xs font-data">{createError}</p>}
            <div className="flex gap-2">
              <button type="submit" className="btn-neon text-xs" disabled={createLoading}>
                Criar
              </button>
              <button
                type="button"
                className="text-nd-text-secondary text-xs font-data hover:text-nd-text"
                onClick={() => setShowCreate(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {crewsLoading ? (
        <span className="text-nd-text-secondary animate-pulse-neon font-data">▌ loading...</span>
      ) : crewsError ? (
        <p className="text-nd-magenta text-sm font-data">{crewsError}</p>
      ) : crews.length === 0 ? (
        <div className="card text-center py-10">
          <p className="text-nd-text-secondary font-data text-sm">Nenhuma crew fundada ainda.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {crews.map((c: Crew) => (
            <button
              key={c.id}
              className="card border-nd-cyan/20 text-left hover:border-nd-cyan/50 transition-colors cursor-pointer"
              onClick={() => navigate(`/crews/${c.id}`)}
            >
              <span className="font-data text-[10px] text-nd-cyan bg-nd-cyan/10 rounded-terminal px-2 py-0.5">
                [{c.tag}]
              </span>
              <h3 className="font-heading text-nd-gold mt-2">{c.name}</h3>
              <p className="text-nd-text-secondary text-xs font-data mt-1">
                Fundada em {new Date(c.createdAt).toLocaleDateString("pt-BR")}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

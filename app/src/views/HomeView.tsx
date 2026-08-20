import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";

/** Landing page: hero + backend health card (port of HomeView.vue). */
export default function HomeView() {
  const health = useAppStore((s) => s.health);
  const healthError = useAppStore((s) => s.healthError);
  const healthLoading = useAppStore((s) => s.healthLoading);
  const checkHealth = useAppStore((s) => s.checkHealth);
  const accessToken = useAuthStore((s) => s.accessToken);
  const character = useAuthStore((s) => s.character);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <div className="flex flex-col items-center justify-center gap-8 py-16">
      {/* Hero */}
      <div className="text-center space-y-4">
        <h2 className="font-heading text-4xl md:text-6xl text-nd-cyan">
          NEON<span className="text-nd-magenta">//</span>DUSK
        </h2>
        <p className="text-nd-text-secondary text-lg font-body max-w-md mx-auto">
          Monta teu cromo. Queima teu nome. Vira lenda.
        </p>
      </div>

      {/* CTA buttons — ND landing-nav */}
      {!accessToken && (
        <Link to="/login" className="btn-neon text-base px-8 py-3">
          Entrar no Jogo
        </Link>
      )}
      {accessToken && !character && (
        <Link to="/create-character" className="btn-neon text-base px-8 py-3">
          Criar Personagem
        </Link>
      )}
      {accessToken && character && (
        <Link to="/dashboard" className="btn-neon text-base px-8 py-3">
          Painel
        </Link>
      )}

      {/* System Status Card */}
      <div className="card w-full max-w-md space-y-3">
        <h3 className="font-heading text-nd-cyan">Status do Sistema</h3>

        {healthLoading ? (
          <div className="text-nd-text-secondary font-data text-sm">
            <span className="animate-pulse-neon">▌ Verificando conexão...</span>
          </div>
        ) : healthError ? (
          <div className="space-y-2">
            <p className="text-nd-magenta font-data text-sm">{healthError}</p>
            <button onClick={() => void checkHealth()} className="btn-neon text-xs">
              Tentar de novo
            </button>
          </div>
        ) : health ? (
          <div className="font-data text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-nd-text-secondary">Status</span>
              <span className={health.status === "ok" ? "text-nd-green" : "text-nd-magenta"}>
                {health.status === "ok" ? "● ONLINE" : "◌ DEGRADED"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-nd-text-secondary">Database</span>
              <span
                className={health.services.database === "connected" ? "text-nd-green" : "text-nd-magenta"}
              >
                {health.services.database}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-nd-text-secondary">Redis</span>
              <span
                className={health.services.redis === "connected" ? "text-nd-green" : "text-nd-magenta"}
              >
                {health.services.redis}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-nd-text-secondary">Uptime</span>
              <span className="text-nd-gold">{Math.floor(health.uptime)}s</span>
            </div>
            <div className="flex justify-between">
              <span className="text-nd-text-secondary">Version</span>
              <span className="text-nd-gold">{health.version}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

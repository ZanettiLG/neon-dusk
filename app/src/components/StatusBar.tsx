import { useEffect } from "react";
import { useAppStore } from "@/stores/app";

/**
 * Backend health indicator. Polls /api/health on mount and shows one of
 * four states: connecting, offline (click to retry), online, degraded
 * (port of StatusBar.vue).
 */
export default function StatusBar() {
  const healthLoading = useAppStore((s) => s.healthLoading);
  const healthError = useAppStore((s) => s.healthError);
  const health = useAppStore((s) => s.health);
  const checkHealth = useAppStore((s) => s.checkHealth);

  useEffect(() => {
    void checkHealth();
  }, [checkHealth]);

  return (
    <div className="flex items-center gap-2 text-xs font-data">
      {healthLoading ? (
        <span className="text-nd-text-secondary animate-pulse-neon">▌ connecting...</span>
      ) : healthError ? (
        <span
          className="text-nd-magenta cursor-pointer"
          title="Click to retry"
          onClick={() => void checkHealth()}
        >
          ◌ offline
        </span>
      ) : health?.status === "ok" ? (
        <span className="text-nd-green"> ● online </span>
      ) : (
        <span className="text-nd-gold"> ◌ degraded </span>
      )}
    </div>
  );
}

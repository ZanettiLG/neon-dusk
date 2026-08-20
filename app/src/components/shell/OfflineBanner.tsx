import { useOnline } from "@/lib/useOnline";
import { useAppStore } from "@/stores/app";

/**
 * Global connectivity banner (issue #13): assertive live region shown while
 * the device is offline (navigator.onLine) OR the last backend health check
 * failed. The degraded-services banner (Redis down) stays separate in App.
 */
export default function OfflineBanner() {
  const online = useOnline();
  const healthError = useAppStore((s) => s.healthError);

  if (online && !healthError) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="bg-nd-magenta/10 border-b border-nd-magenta/40 px-4 py-2 text-center"
    >
      <span className="text-nd-magenta text-sm font-data">
        ◌ SEM CONEXÃO — dados podem estar desatualizados
      </span>
    </div>
  );
}

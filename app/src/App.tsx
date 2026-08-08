import { Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";

/** Inline banner shown while the backend is degraded (Redis down, etc.). */
function DegradedBanner() {
  const health = useAppStore((s) => s.health);
  const initializationError = useAuthStore((s) => s.initializationError);

  const isDegraded = health?.status === "degraded" || initializationError;
  if (!isDegraded) return null;

  return (
    <div className="bg-nd-gold/10 border-b border-nd-gold/30 px-4 py-2 text-center">
      <span className="text-nd-gold text-sm font-data">
        ⚠ Sistema degradado — algumas funções podem estar indisponíveis
      </span>
    </div>
  );
}

/** App shell: header + routed content + footer (port of App.vue). */
export default function App() {
  return (
    <div className="min-h-screen bg-nd-bg flex flex-col">
      <AppHeader />
      <DegradedBanner />
      <main className="flex-1">
        <Outlet />
      </main>
      <AppFooter />
    </div>
  );
}

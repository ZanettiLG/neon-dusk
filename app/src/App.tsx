import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import AppHeader from "@/components/AppHeader";
import AppFooter from "@/components/AppFooter";
import OfflineBanner from "@/components/shell/OfflineBanner";
import Hud from "@/components/shell/Hud";
import TimerAlerts from "@/components/shell/TimerAlerts";
import BottomNav from "@/components/shell/BottomNav";
import Drawer from "@/components/shell/Drawer";
import { useAppStore } from "@/stores/app";
import { useAuthStore } from "@/stores/auth";
import InstallPrompt from "@/components/InstallPrompt";
import RankUpCelebration from "@/components/RankUpCelebration";

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

/**
 * App shell (issue #13): header + degraded/offline banners + routed content.
 * With a character, the persistent HUD/timer strip sticks to the top, the
 * mobile bottom nav + secondary drawer show, `main` reserves room for the
 * fixed nav and the footer hides on mobile. Drawer state lives here so the
 * header toggle and the BottomNav "Mais" button share it.
 */
export default function App() {
  const hasCharacter = useAuthStore((s) => !!s.character);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  return (
    <div className="min-h-screen bg-nd-bg flex flex-col">
      <AppHeader drawerOpen={drawerOpen} onOpenDrawer={openDrawer} />
      <DegradedBanner />
      <OfflineBanner />
      {hasCharacter && (
        <div className="sticky top-0 z-nd-header">
          <Hud />
          <TimerAlerts />
        </div>
      )}
      <main className={`flex-1 ${hasCharacter ? "pb-20 sm:pb-0" : ""}`}>
        <Outlet />
      </main>
      <InstallPrompt />
      <RankUpCelebration />
      <AppFooter />
      {hasCharacter && (
        <>
          <BottomNav drawerOpen={drawerOpen} onOpenDrawer={openDrawer} />
          <Drawer open={drawerOpen} onClose={closeDrawer} />
        </>
      )}
    </div>
  );
}

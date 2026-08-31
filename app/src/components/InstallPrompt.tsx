import { useState, useEffect, useCallback } from "react";

/** localStorage key for persisting user dismissal choice. */
const DISMISSED_KEY = "nd-pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Shows an "Install Neon Dusk" button when the browser fires the
 * `beforeinstallprompt` event. Respects localStorage dismissal so the banner
 * does not reappear after the user explicitly closes it.
 *
 * Behaviour:
 * - Visible only when `beforeinstallprompt` has fired AND not previously dismissed.
 * - Clicking the install button triggers the native prompt.
 * - Clicking "Later" writes dismissal to localStorage and hides the banner.
 */
export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  // Initialise: check for previous dismissal
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISSED_KEY);
    if (dismissed) return; // user chose "Later" previously

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  /** Fire the native install prompt, then persist acceptance. */
  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      localStorage.setItem(DISMISSED_KEY, "1");
    }
    setDeferredPrompt(null);
    setVisible(false);
  }, [deferredPrompt]);

  /** Dismiss the banner without installing; persist choice. */
  const handleDismiss = useCallback(() => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferredPrompt(null);
    setVisible(false);
  }, []);

  // Called by parent to re-check if install is available (e.g. after route change)
  const handleLater = useCallback(() => {
    setVisible(false);
  }, []);

  if (!visible || !deferredPrompt) return null;

  return (
    <div
      className="fixed bottom-16 left-0 right-0 z-nd-overlay mx-auto w-full max-w-md px-4"
      role="alert"
      aria-live="polite"
    >
      <div className="card border-nd-gold/40 bg-nd-surface/95 backdrop-blur flex items-center justify-between gap-3 animate-pulse-neon">
        <p className="text-nd-gold font-data text-sm flex-1">
          Instalar Neon Dusk no seu dispositivo?
        </p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleInstall}
            className="btn-neon text-xs px-3 py-1 border-nd-gold text-nd-gold bg-nd-gold/10 hover:bg-nd-gold/20 hover:shadow-neon-gold"
          >
            Instalar
          </button>
          <button
            onClick={handleLater}
            className="text-nd-text-secondary text-xs font-data px-2 py-1 hover:text-nd-text transition-colors"
            aria-label="Lembrar depois"
          >
            Depois
          </button>
          <button
            onClick={handleDismiss}
            className="text-nd-text-secondary text-xs font-data px-2 py-1 hover:text-nd-magenta transition-colors"
            aria-label="Não mostrar novamente"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

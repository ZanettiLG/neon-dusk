import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import { useAuthStore } from "@/stores/auth";
import { AppRouter } from "@/router";
import "./style.css";

// PWA service worker (issue #13): immediate registration — the manifest-driven
// precache keeps the app shell available offline. Module is virtual, provided
// by vite-plugin-pwa (types declared in app/env.d.ts).
registerSW({ immediate: true });

async function bootstrap() {
  // Zustand persist hydrates tokens from localStorage on store creation; this
  // restores the session (fetchMe) BEFORE first render so guards never see a
  // flash of incorrect auth state (design §11.5).
  await useAuthStore.getState().bootstrap();

  createRoot(document.getElementById("app")!).render(
    <StrictMode>
      <AppRouter />
    </StrictMode>,
  );
}

void bootstrap();

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useAuthStore } from "@/stores/auth";
import { AppRouter } from "@/router";
import "./style.css";

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

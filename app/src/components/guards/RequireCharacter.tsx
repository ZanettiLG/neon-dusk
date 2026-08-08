import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Redirects users without a character to /create-character (design §3.2). */
export function RequireCharacter() {
  const character = useAuthStore((s) => s.character);
  const initializationError = useAuthStore((s) => s.initializationError);

  // When the backend is degraded, character is null only because /api/auth/me
  // failed — don't force the user into /create-character (a dead-end while
  // Redis is down). Render children and let the view show the degraded state.
  if (!character && !initializationError) return <Navigate to="/create-character" replace />;
  return <Outlet />;
}

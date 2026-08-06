import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Redirects users who already have a character to /dashboard (design §3.2). */
export function RequireCharacterless() {
  const character = useAuthStore((s) => s.character);
  if (character) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

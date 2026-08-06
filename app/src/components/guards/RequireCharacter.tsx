import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Redirects users without a character to /create-character (design §3.2). */
export function RequireCharacter() {
  const character = useAuthStore((s) => s.character);
  if (!character) return <Navigate to="/create-character" replace />;
  return <Outlet />;
}
